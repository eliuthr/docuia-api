import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Code } from 'aws-cdk-lib/aws-lambda';
import { beforeAll, describe, expect, it } from 'vitest';
import { CAPACITY_UNITS } from './data-stores';
import { DocuiaStack, WORKER_HANDLER } from './docuia-stack';

const OPENAI_API_KEY = 'sk-test-never-in-outputs';

type Resource = { Properties: Record<string, unknown> };

function synthesize(): Template {
  const app = new App();
  const stack = new DocuiaStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
    lambdaCode: Code.fromInline('exports.handler = async () => {};'),
    openAiApiKey: OPENAI_API_KEY,
    corsOrigin: 'http://localhost:4200',
  });
  return Template.fromStack(stack);
}

/** Suma las unidades de una propiedad de todas las tablas y sus índices. */
function totalCapacity(
  tables: Record<string, Resource>,
  unit: 'ReadCapacityUnits' | 'WriteCapacityUnits',
): number {
  let total = 0;
  for (const { Properties } of Object.values(tables)) {
    const throughput = Properties.ProvisionedThroughput as Record<
      string,
      number
    >;
    total += throughput[unit];
    const indexes = (Properties.GlobalSecondaryIndexes ?? []) as {
      ProvisionedThroughput: Record<string, number>;
    }[];
    total += indexes.reduce(
      (sum, index) => sum + index.ProvisionedThroughput[unit],
      0,
    );
  }
  return total;
}

function policyStatementsOf(template: Template, roleLogicalIdPrefix: string) {
  const policies = template.findResources('AWS::IAM::Policy');
  return Object.entries(policies)
    .filter(([logicalId]) => logicalId.startsWith(roleLogicalIdPrefix))
    .flatMap(([, policy]) => {
      const document = (policy as Resource).Properties.PolicyDocument as {
        Statement: { Action: string | string[] }[];
      };
      return document.Statement.flatMap((statement) =>
        Array.isArray(statement.Action) ? statement.Action : [statement.Action],
      );
    });
}

describe('DocuiaStack', () => {
  let template: Template;

  beforeAll(() => {
    template = synthesize();
  });

  it('runs both functions on Node.js 24, arm64 and without a VPC', () => {
    const functions = template.findResources('AWS::Lambda::Function', {
      Properties: { Runtime: 'nodejs24.x', Architectures: ['arm64'] },
    });
    expect(Object.keys(functions)).toHaveLength(2);
    for (const { Properties } of Object.values(functions) as Resource[]) {
      expect(Properties.VpcConfig).toBeUndefined();
    }
    template.resourceCountIs('AWS::EC2::VPC', 0);
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  it('exposes the API through a public function URL with response streaming', () => {
    template.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'NONE',
      InvokeMode: 'RESPONSE_STREAM',
    });
  });

  it('starts the API with the Lambda Web Adapter and the AWS drivers', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'run.sh',
      Layers: [Match.stringLikeRegexp('LambdaAdapterLayerArm64:30')],
      Environment: {
        Variables: Match.objectLike({
          AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
          AWS_LWA_INVOKE_MODE: 'response_stream',
          AWS_LWA_READINESS_CHECK_PATH: '/health',
          PORT: '8080',
          DATABASE_DRIVER: 'dynamodb',
          STORAGE_DRIVER: 's3',
          QUEUE_DRIVER: 'sqs',
          EVENTS_DRIVER: 'none',
          LOG_FORMAT: 'json',
          MAX_UPLOAD_SIZE_MB: '5',
        }),
      },
    });
  });

  it('feeds the worker one SQS message at a time with partial batch failures', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'dist/lambda/index.handler',
    });
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 1,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
    });
  });

  it('names the worker handler as file.function, with no dots in the file name', () => {
    // Lambda corta en el primer punto del nombre del archivo: `a.b.handler` buscaría el archivo `a`.
    const fileName = WORKER_HANDLER.split('/').at(-1) ?? '';
    expect(fileName.split('.')).toHaveLength(2);
  });

  it('retries jobs through the visibility timeout and keeps failed ones in a DLQ', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      VisibilityTimeout: 720,
      RedrivePolicy: Match.objectLike({ maxReceiveCount: 4 }),
    });
    template.resourceCountIs('AWS::SQS::Queue', 2);
  });

  it('keeps the DynamoDB capacity within the 25 free read and write units', () => {
    const tables = template.findResources('AWS::DynamoDB::Table') as Record<
      string,
      Resource
    >;
    expect(Object.keys(tables)).toHaveLength(3);
    expect(totalCapacity(tables, 'ReadCapacityUnits')).toBe(5 * CAPACITY_UNITS);
    expect(totalCapacity(tables, 'WriteCapacityUnits')).toBe(
      5 * CAPACITY_UNITS,
    );
  });

  it('retains the data on destroy and blocks public access to the bucket', () => {
    template.allResources('AWS::DynamoDB::Table', { DeletionPolicy: 'Retain' });
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      }),
    });
  });

  it('keeps the logs for 7 days', () => {
    template.allResourcesProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 7,
    });
    template.resourceCountIs('AWS::Logs::LogGroup', 2);
  });

  it('lets only the API send jobs to the queue', () => {
    expect(policyStatementsOf(template, 'Api')).toContain('sqs:SendMessage');
    expect(policyStatementsOf(template, 'Worker')).not.toContain(
      'sqs:SendMessage',
    );
  });

  it('never puts the OpenAI key in the stack outputs', () => {
    const outputs = JSON.stringify(template.toJSON().Outputs);

    expect(outputs).toContain('ApiUrl');
    expect(outputs).not.toContain(OPENAI_API_KEY);
  });
});

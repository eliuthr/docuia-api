import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {
  Architecture,
  Code,
  Function as LambdaFunction,
  FunctionUrlAuthType,
  ILayerVersion,
  InvokeMode,
  LayerVersion,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ISource } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { DataStores } from './data-stores';
import { PROCESSING_MAX_ATTEMPTS, ProcessingQueue } from './processing-queue';
import { WebHosting } from './web-hosting';

const MEMORY_MB = 1024;
const FUNCTION_TIMEOUT = Duration.seconds(120);
/** Las Function URLs aceptan peticiones de hasta 6 MB; se deja margen para el multipart. */
const MAX_UPLOAD_SIZE_MB = 5;
/** Puerto donde escucha NestJS dentro de la Lambda; el Lambda Web Adapter le reenvía las peticiones. */
const API_PORT = 8080;
/**
 * Lambda lee el handler como `archivo.función` y corta en el primer punto del
 * nombre del archivo, así que el archivo no puede tener puntos (ver src/lambda/index.ts).
 */
export const WORKER_HANDLER = 'dist/lambda/index.handler';
/** Capa pública de AWS con el Lambda Web Adapter (arm64, versión 30) en la región del stack. */
function webAdapterLayerArn(region: string): string {
  return `arn:aws:lambda:${region}:753240598075:layer:LambdaAdapterLayerArm64:30`;
}

export interface DocuiaStackProps extends StackProps {
  /** El zip con `dist/`, `node_modules/` y `run.sh` (ver scripts/package-lambda.mjs). */
  lambdaCode: Code;
  /** Se guarda como variable de entorno de las Lambdas; nunca en el repositorio. */
  openAiApiKey: string;
  /** El build de Angular de docuia-web (ver scripts/build-web.mjs). */
  webAssets: ISource;
}

/**
 * DocuIA en AWS: el cliente web en S3 + CloudFront, la API y el worker en
 * Lambda (arm64, sin VPC), archivos en S3, trabajos en SQS y datos en
 * DynamoDB. Todo dentro de la capa gratuita.
 */
export class DocuiaStack extends Stack {
  constructor(scope: Construct, id: string, props: DocuiaStackProps) {
    super(scope, id, props);
    const data = new DataStores(this, 'Data');
    const processing = new ProcessingQueue(this, 'Processing', {
      workerTimeout: FUNCTION_TIMEOUT,
    });
    const web = new WebHosting(this, 'Web');
    // La API solo acepta peticiones del navegador que vengan del cliente web.
    const environment = this.appEnvironment(data, processing, {
      corsOrigin: web.origin,
      openAiApiKey: props.openAiApiKey,
    });

    const api = this.createApi(props.lambdaCode, environment);
    // Incluye borrar: la API elimina el archivo si no puede encolar el documento.
    data.bucket.grantReadWrite(api);
    data.documentsTable.grantReadWriteData(api);
    data.conversationsTable.grantReadWriteData(api);
    data.messagesTable.grantReadWriteData(api);
    processing.queue.grantSendMessages(api);

    const worker = this.createWorker(props.lambdaCode, environment);
    data.bucket.grantReadWrite(worker);
    data.documentsTable.grantReadWriteData(worker);
    worker.addEventSource(
      new SqsEventSource(processing.queue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );

    const url = api.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      invokeMode: InvokeMode.RESPONSE_STREAM,
    });
    web.deployContent(props.webAssets, { apiBaseUrl: url.url });
    new CfnOutput(this, 'WebUrl', { value: web.origin });
    new CfnOutput(this, 'ApiUrl', { value: url.url });
    new CfnOutput(this, 'DeadLetterQueueUrl', {
      value: processing.deadLetterQueue.queueUrl,
    });
    // Para seguir los logs: aws logs tail <nombre> --follow
    new CfnOutput(this, 'ApiLogGroup', { value: api.logGroup.logGroupName });
    new CfnOutput(this, 'WorkerLogGroup', {
      value: worker.logGroup.logGroupName,
    });
  }

  /** Las mismas variables que valida la API al arrancar, con los drivers de AWS. */
  private appEnvironment(
    data: DataStores,
    processing: ProcessingQueue,
    settings: { corsOrigin: string; openAiApiKey: string },
  ): Record<string, string> {
    return {
      NODE_ENV: 'production',
      LOG_FORMAT: 'json',
      CORS_ORIGIN: settings.corsOrigin,
      DATABASE_DRIVER: 'dynamodb',
      DYNAMODB_DOCUMENTS_TABLE: data.documentsTable.tableName,
      DYNAMODB_CONVERSATIONS_TABLE: data.conversationsTable.tableName,
      DYNAMODB_MESSAGES_TABLE: data.messagesTable.tableName,
      STORAGE_DRIVER: 's3',
      S3_BUCKET: data.bucket.bucketName,
      MAX_UPLOAD_SIZE_MB: String(MAX_UPLOAD_SIZE_MB),
      QUEUE_DRIVER: 'sqs',
      SQS_QUEUE_URL: processing.queue.queueUrl,
      PROCESSING_MAX_ATTEMPTS: String(PROCESSING_MAX_ATTEMPTS),
      EVENTS_DRIVER: 'none',
      OPENAI_API_KEY: settings.openAiApiKey,
    };
  }

  /**
   * La API corre como un servidor NestJS normal: el Lambda Web Adapter lo
   * arranca con `run.sh` y le reenvía cada petición, con respuesta en streaming.
   */
  private createApi(
    code: Code,
    environment: Record<string, string>,
  ): LambdaFunction {
    return this.createFunction(
      'Api',
      code,
      'run.sh',
      {
        ...environment,
        PORT: String(API_PORT),
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
        AWS_LWA_INVOKE_MODE: 'response_stream',
        AWS_LWA_READINESS_CHECK_PATH: '/health',
      },
      [
        LayerVersion.fromLayerVersionArn(
          this,
          'WebAdapter',
          webAdapterLayerArn(this.region),
        ),
      ],
    );
  }

  private createWorker(
    code: Code,
    environment: Record<string, string>,
  ): LambdaFunction {
    return this.createFunction('Worker', code, WORKER_HANDLER, environment);
  }

  private createFunction(
    id: string,
    code: Code,
    handler: string,
    environment: Record<string, string>,
    layers: ILayerVersion[] = [],
  ): LambdaFunction {
    return new LambdaFunction(this, id, {
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: MEMORY_MB,
      timeout: FUNCTION_TIMEOUT,
      code,
      handler,
      environment,
      layers,
      logGroup: new LogGroup(this, `${id}Logs`, {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
  }
}

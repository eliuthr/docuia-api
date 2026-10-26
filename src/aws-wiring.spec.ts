import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { ConversationRepository } from './conversations/repositories/conversation.repository.js';
import { DynamoDbConversationRepository } from './conversations/repositories/dynamodb-conversation.repository.js';
import { DocumentEventsPublisher } from './documents/events/document-events.publisher.js';
import { DocumentEventsSubscriber } from './documents/events/document-events.subscriber.js';
import { NoopDocumentEventsPublisher } from './documents/events/noop-document-events.publisher.js';
import { UnavailableDocumentEventsSubscriber } from './documents/events/unavailable-document-events.subscriber.js';
import { DocumentRepository } from './documents/repositories/document.repository.js';
import { DynamoDbDocumentRepository } from './documents/repositories/dynamodb-document.repository.js';
import { QueueProvider } from './processing/queue/queue.provider.js';
import { SqsQueueProvider } from './processing/queue/sqs-queue.provider.js';
import { SqsDocumentConsumer } from './processing/sqs-document.consumer.js';
import { S3StorageProvider } from './storage/s3-storage.provider.js';
import { StorageProvider } from './storage/storage.provider.js';

/** Configuración del despliegue en AWS (la que pone CDK en las Lambdas). */
const AWS_ENV: Record<string, string> = {
  OPENAI_API_KEY: 'sk-test',
  DATABASE_DRIVER: 'dynamodb',
  DYNAMODB_DOCUMENTS_TABLE: 'docuia-documents',
  DYNAMODB_CONVERSATIONS_TABLE: 'docuia-conversations',
  DYNAMODB_MESSAGES_TABLE: 'docuia-messages',
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'docuia-files',
  QUEUE_DRIVER: 'sqs',
  SQS_QUEUE_URL: 'https://sqs.us-east-1.amazonaws.com/123456789012/docuia',
  EVENTS_DRIVER: 'none',
};

/** Importar la app completa tarda varios segundos cuando corre junto al resto de la suite. */
const WIRING_TEST_TIMEOUT_MS = 30_000;

/**
 * Comprueba que con los drivers de AWS ningún módulo de Mongo, BullMQ o Redis
 * se carga (AC-1.2): si se cargaran, intentarían conectarse a servidores que
 * no existen en Lambda.
 *
 * Los módulos raíz se importan después de definir las variables, como en
 * Lambda: ConditionalModule elige el driver al importarse el módulo.
 */
describe('AWS wiring', { timeout: WIRING_TEST_TIMEOUT_MS }, () => {
  beforeAll(() => {
    for (const [key, value] of Object.entries(AWS_ENV)) {
      vi.stubEnv(key, value);
    }
  });

  afterAll(() => vi.unstubAllEnvs());

  it('wires the API with the AWS implementations and no MongoDB connection', async () => {
    const { AppModule } = await import('./app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef.get(DocumentRepository)).toBeInstanceOf(
      DynamoDbDocumentRepository,
    );
    expect(moduleRef.get(ConversationRepository)).toBeInstanceOf(
      DynamoDbConversationRepository,
    );
    expect(moduleRef.get(QueueProvider)).toBeInstanceOf(SqsQueueProvider);
    expect(moduleRef.get(StorageProvider, { strict: false })).toBeInstanceOf(
      S3StorageProvider,
    );
    expect(moduleRef.get(DocumentEventsSubscriber)).toBeInstanceOf(
      UnavailableDocumentEventsSubscriber,
    );
    expect(() => moduleRef.get(getConnectionToken())).toThrow();
    await moduleRef.close();
  });

  it('wires the Lambda worker with the SQS consumer and the AWS implementations', async () => {
    const { LambdaWorkerModule } =
      await import('./lambda/lambda-worker.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [LambdaWorkerModule],
    }).compile();

    expect(moduleRef.get(SqsDocumentConsumer)).toBeInstanceOf(
      SqsDocumentConsumer,
    );
    expect(moduleRef.get(DocumentEventsPublisher)).toBeInstanceOf(
      NoopDocumentEventsPublisher,
    );
    expect(moduleRef.get(DocumentRepository)).toBeInstanceOf(
      DynamoDbDocumentRepository,
    );
    expect(() => moduleRef.get(getConnectionToken())).toThrow();
    await moduleRef.close();
  });
});

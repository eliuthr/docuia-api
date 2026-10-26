import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import { Env } from '../../config/env.schema.js';
import { SqsQueueProvider } from './sqs-queue.provider.js';

const QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/docuia';

describe('SqsQueueProvider', () => {
  const sqs = mockClient(SQSClient);
  let queue: SqsQueueProvider;

  beforeEach(() => {
    sqs.reset();
    const config = {
      get: () => QUEUE_URL,
    } as unknown as ConfigService<Env, true>;
    queue = new SqsQueueProvider(new SQSClient({}), config);
  });

  it('sends one message with the document id', async () => {
    sqs.on(SendMessageCommand).resolves({ MessageId: 'message-1' });

    await queue.enqueue({ documentId: 'doc-1' });

    expect(sqs.commandCalls(SendMessageCommand)[0].args[0].input).toEqual({
      QueueUrl: QUEUE_URL,
      MessageBody: '{"documentId":"doc-1"}',
    });
  });

  it('lets SQS errors through so the upload responds 503', async () => {
    sqs.on(SendMessageCommand).rejects(new Error('Service unavailable'));

    await expect(queue.enqueue({ documentId: 'doc-1' })).rejects.toThrow(
      'Service unavailable',
    );
  });
});

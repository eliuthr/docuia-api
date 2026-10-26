import { Logger } from '@nestjs/common';
import type { SQSEvent } from 'aws-lambda';
import { buildSqsRecord } from '../../test/support/build-sqs-record.js';
import { SqsDocumentConsumer } from '../processing/sqs-document.consumer.js';
import { processSqsEvent } from './process-sqs-event.js';

function eventWith(...messageIds: string[]): SQSEvent {
  return {
    Records: messageIds.map((id) =>
      buildSqsRecord('{"documentId":"doc-1"}', 1, id),
    ),
  };
}

describe('processSqsEvent', () => {
  let handle: ReturnType<typeof vi.fn>;
  let consumer: SqsDocumentConsumer;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    handle = vi.fn().mockResolvedValue('processed');
    consumer = { handle } as unknown as SqsDocumentConsumer;
  });

  it('reports no failures when every message is processed', async () => {
    await expect(
      processSqsEvent(consumer, eventWith('message-1')),
    ).resolves.toEqual({ batchItemFailures: [] });
  });

  it('reports only the messages that must be retried', async () => {
    handle.mockResolvedValueOnce('retry').mockResolvedValueOnce('processed');

    await expect(
      processSqsEvent(consumer, eventWith('message-1', 'message-2')),
    ).resolves.toEqual({
      batchItemFailures: [{ itemIdentifier: 'message-1' }],
    });
  });

  it('retries a message whose handling crashed', async () => {
    handle.mockRejectedValue(new Error('DynamoDB throttled'));

    await expect(
      processSqsEvent(consumer, eventWith('message-1')),
    ).resolves.toEqual({
      batchItemFailures: [{ itemIdentifier: 'message-1' }],
    });
  });
});

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildSqsRecord } from '../../test/support/build-sqs-record.js';
import { Env } from '../config/env.schema.js';
import { DocumentJobRunner } from './document-job.runner.js';
import { SqsDocumentConsumer } from './sqs-document.consumer.js';

const MAX_ATTEMPTS = 3;

describe('SqsDocumentConsumer', () => {
  let run: ReturnType<typeof vi.fn>;
  let consumer: SqsDocumentConsumer;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    run = vi.fn().mockResolvedValue({ kind: 'done' });
    const config = {
      get: () => MAX_ATTEMPTS,
    } as unknown as ConfigService<Env, true>;
    consumer = new SqsDocumentConsumer(
      { run } as unknown as DocumentJobRunner,
      config,
    );
  });

  it('runs the job with the SQS receive count as the attempt', async () => {
    await expect(
      consumer.handle(buildSqsRecord('{"documentId":"doc-1"}', 2)),
    ).resolves.toBe('processed');

    expect(run).toHaveBeenCalledWith({
      documentId: 'doc-1',
      attempt: 2,
      maxAttempts: MAX_ATTEMPTS,
    });
  });

  it('returns the message to the queue when the runner asks for a retry', async () => {
    run.mockResolvedValue({ kind: 'retry', error: new Error('timeout') });

    await expect(
      consumer.handle(buildSqsRecord('{"documentId":"doc-1"}')),
    ).resolves.toBe('retry');
  });

  it('removes the message once the document failed', async () => {
    run.mockResolvedValue({ kind: 'failed', message: 'corrupt PDF' });

    await expect(
      consumer.handle(buildSqsRecord('{"documentId":"doc-1"}')),
    ).resolves.toBe('processed');
  });

  it('drops a malformed message without running it', async () => {
    await expect(consumer.handle(buildSqsRecord('not json'))).resolves.toBe(
      'processed',
    );
    expect(run).not.toHaveBeenCalled();
  });
});

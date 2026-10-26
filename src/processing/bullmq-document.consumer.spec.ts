import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import { Env } from '../config/env.schema.js';
import { BullmqDocumentConsumer } from './bullmq-document.consumer.js';
import { DocumentJobRunner } from './document-job.runner.js';
import { DocumentJob } from './queue/document-job.js';

const MAX_ATTEMPTS = 3;

function buildJob(attemptsMade: number): Job<DocumentJob> {
  return {
    data: { documentId: 'doc-1' },
    attemptsMade,
    opts: { attempts: MAX_ATTEMPTS },
  } as unknown as Job<DocumentJob>;
}

describe('BullmqDocumentConsumer', () => {
  let run: ReturnType<typeof vi.fn>;
  let consumer: BullmqDocumentConsumer;

  beforeEach(() => {
    run = vi.fn().mockResolvedValue({ kind: 'done' });
    consumer = new BullmqDocumentConsumer(
      { run } as unknown as DocumentJobRunner,
      {} as ConfigService<Env, true>,
    );
  });

  it('runs the job with the BullMQ attempt number', async () => {
    await consumer.process(buildJob(1));

    expect(run).toHaveBeenCalledWith({
      documentId: 'doc-1',
      attempt: 2,
      maxAttempts: MAX_ATTEMPTS,
    });
  });

  it('rethrows the error so BullMQ retries the job', async () => {
    const failure = new Error('storage timeout');
    run.mockResolvedValue({ kind: 'retry', error: failure });

    await expect(consumer.process(buildJob(0))).rejects.toBe(failure);
  });

  it('stops BullMQ retries once the document failed', async () => {
    run.mockResolvedValue({ kind: 'failed', message: 'corrupt PDF' });

    await expect(consumer.process(buildJob(0))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});

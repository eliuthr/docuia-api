import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Env } from '../../config/env.schema.js';
import { BullmqQueueProvider } from './bullmq-queue.provider.js';
import { DocumentJob, PROCESS_DOCUMENT_JOB } from './document-job.js';

const settings: Partial<Env> = {
  PROCESSING_MAX_ATTEMPTS: 3,
  PROCESSING_BACKOFF_MS: 5000,
};

describe('BullmqQueueProvider', () => {
  let add: ReturnType<typeof vi.fn>;
  let provider: BullmqQueueProvider;

  beforeEach(() => {
    add = vi.fn().mockResolvedValue(undefined);
    provider = new BullmqQueueProvider(
      { add } as unknown as Queue<DocumentJob>,
      {
        get: (key: keyof Env) => settings[key],
      } as unknown as ConfigService<Env, true>,
    );
  });

  it('adds a job keyed by the document id with retry options', async () => {
    await provider.enqueue({ documentId: 'doc-1' });

    expect(add).toHaveBeenCalledWith(
      PROCESS_DOCUMENT_JOB,
      { documentId: 'doc-1' },
      expect.objectContaining({
        jobId: 'doc-1',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      }),
    );
  });

  it('propagates queue failures', async () => {
    add.mockRejectedValue(new Error('Redis down'));

    await expect(provider.enqueue({ documentId: 'doc-1' })).rejects.toThrow(
      'Redis down',
    );
  });
});

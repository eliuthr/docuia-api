import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import { Env } from '../config/env.schema.js';
import { BullmqDocumentConsumer } from './bullmq-document.consumer.js';
import { DocumentProcessingService } from './document-processing.service.js';
import {
  GENERIC_FAILURE_REASON,
  UnreadableDocumentError,
} from './errors/unreadable-document.error.js';
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
  let processing: {
    process: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
  };
  let consumer: BullmqDocumentConsumer;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    processing = {
      process: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    consumer = new BullmqDocumentConsumer(
      processing as unknown as DocumentProcessingService,
      {} as ConfigService<Env, true>,
    );
  });

  it('processes the document of the job', async () => {
    await consumer.process(buildJob(0));

    expect(processing.process).toHaveBeenCalledWith('doc-1');
  });

  it('rethrows a transient error so BullMQ retries it', async () => {
    const failure = new Error('storage timeout');
    processing.process.mockRejectedValue(failure);

    await expect(consumer.process(buildJob(0))).rejects.toBe(failure);

    expect(processing.markFailed).not.toHaveBeenCalled();
  });

  it('marks the document failed on the last attempt with a generic reason', async () => {
    processing.process.mockRejectedValue(new Error('storage timeout'));

    await expect(
      consumer.process(buildJob(MAX_ATTEMPTS - 1)),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(processing.markFailed).toHaveBeenCalledWith(
      'doc-1',
      GENERIC_FAILURE_REASON,
    );
  });

  it('fails an unreadable document immediately with its own reason', async () => {
    processing.process.mockRejectedValue(
      new UnreadableDocumentError('The PDF file is corrupt or cannot be read.'),
    );

    await expect(consumer.process(buildJob(0))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(processing.markFailed).toHaveBeenCalledWith(
      'doc-1',
      'The PDF file is corrupt or cannot be read.',
    );
  });
});

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import { Env } from '../config/env.schema.js';
import { DocumentJobRunner } from './document-job.runner.js';
import {
  DOCUMENT_PROCESSING_QUEUE,
  DocumentJob,
} from './queue/document-job.js';

const DEFAULT_ATTEMPTS = 1;

/** Adapta los trabajos de BullMQ a DocumentJobRunner y traduce su resultado. */
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class BullmqDocumentConsumer
  extends WorkerHost
  implements OnApplicationBootstrap
{
  constructor(
    private readonly runner: DocumentJobRunner,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.concurrency = this.config.get('WORKER_CONCURRENCY', {
      infer: true,
    });
  }

  /** Relanzar el error hace que BullMQ reintente; UnrecoverableError lo detiene. */
  async process(job: Job<DocumentJob>): Promise<void> {
    const outcome = await this.runner.run({
      documentId: job.data.documentId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? DEFAULT_ATTEMPTS,
    });
    if (outcome.kind === 'retry') {
      throw outcome.error;
    }
    if (outcome.kind === 'failed') {
      throw new UnrecoverableError(outcome.message);
    }
  }
}

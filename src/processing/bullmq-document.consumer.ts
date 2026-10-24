import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import { Env } from '../config/env.schema.js';
import { DocumentProcessingService } from './document-processing.service.js';
import {
  failureReasonFor,
  UnreadableDocumentError,
} from './errors/unreadable-document.error.js';
import {
  DOCUMENT_PROCESSING_QUEUE,
  DocumentJob,
} from './queue/document-job.js';

const DEFAULT_ATTEMPTS = 1;

/** Adapta los trabajos de BullMQ a DocumentProcessingService y decide los reintentos. */
@Processor(DOCUMENT_PROCESSING_QUEUE)
export class BullmqDocumentConsumer
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(BullmqDocumentConsumer.name);

  constructor(
    private readonly processing: DocumentProcessingService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.concurrency = this.config.get('WORKER_CONCURRENCY', {
      infer: true,
    });
  }

  async process(job: Job<DocumentJob>): Promise<void> {
    const { documentId } = job.data;
    const attempt = job.attemptsMade + 1;
    this.logger.log({ event: 'document.job.started', documentId, attempt });
    try {
      await this.processing.process(documentId);
    } catch (error) {
      await this.handleFailure(job, attempt, error);
    }
  }

  /** Relanza el error para que BullMQ reintente, o marca el documento como fallido y se detiene. */
  private async handleFailure(
    job: Job<DocumentJob>,
    attempt: number,
    error: unknown,
  ): Promise<never> {
    const { documentId } = job.data;
    const isFinal =
      error instanceof UnreadableDocumentError ||
      attempt >= (job.opts.attempts ?? DEFAULT_ATTEMPTS);
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn({
      event: 'document.job.failed',
      documentId,
      attempt,
      isFinal,
      error: message,
    });

    if (!isFinal) {
      throw error;
    }
    await this.processing.markFailed(documentId, failureReasonFor(error));
    throw new UnrecoverableError(message);
  }
}

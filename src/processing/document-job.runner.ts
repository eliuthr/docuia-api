import { Injectable, Logger } from '@nestjs/common';
import { DocumentProcessingService } from './document-processing.service.js';
import {
  failureReasonFor,
  PermanentProcessingError,
} from './errors/permanent-processing.error.js';

export interface DocumentJobAttempt {
  documentId: string;
  /** Número de intento, empezando en 1. */
  attempt: number;
  maxAttempts: number;
}

/**
 * Qué hacer con el trabajo después del intento:
 * - `done`: terminó bien.
 * - `retry`: falla transitoria con intentos disponibles; la cola debe reintentarlo.
 * - `failed`: el documento ya quedó `failed`; la cola no debe reintentarlo.
 */
export type DocumentJobOutcome =
  | { kind: 'done' }
  | { kind: 'retry'; error: unknown }
  | { kind: 'failed'; message: string };

/**
 * Ejecuta un intento de procesamiento y decide si reintentar. Es igual para
 * BullMQ y para SQS; cada consumidor solo traduce el resultado a su cola.
 */
@Injectable()
export class DocumentJobRunner {
  private readonly logger = new Logger(DocumentJobRunner.name);

  constructor(private readonly processing: DocumentProcessingService) {}

  async run(job: DocumentJobAttempt): Promise<DocumentJobOutcome> {
    const { documentId, attempt } = job;
    this.logger.log({ event: 'document.job.started', documentId, attempt });
    try {
      await this.processing.process(documentId);
      return { kind: 'done' };
    } catch (error) {
      return this.handleFailure(job, error);
    }
  }

  private async handleFailure(
    job: DocumentJobAttempt,
    error: unknown,
  ): Promise<DocumentJobOutcome> {
    const { documentId, attempt } = job;
    const isFinal =
      error instanceof PermanentProcessingError || attempt >= job.maxAttempts;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn({
      event: 'document.job.failed',
      documentId,
      attempt,
      isFinal,
      error: message,
    });
    if (!isFinal) {
      return { kind: 'retry', error };
    }
    await this.processing.markFailed(documentId, failureReasonFor(error));
    return { kind: 'failed', message };
  }
}

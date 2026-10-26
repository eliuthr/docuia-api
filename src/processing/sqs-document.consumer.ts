import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SQSRecord } from 'aws-lambda';
import { Env } from '../config/env.schema.js';
import { DocumentJobRunner } from './document-job.runner.js';
import { parseDocumentJob } from './queue/document-job.js';

/** `retry`: el mensaje debe volver a la cola; `processed`: se puede borrar. */
export type SqsRecordOutcome = 'processed' | 'retry';

/** Adapta los mensajes de SQS a DocumentJobRunner y traduce su resultado. */
@Injectable()
export class SqsDocumentConsumer {
  private readonly logger = new Logger(SqsDocumentConsumer.name);
  private readonly maxAttempts: number;

  constructor(
    private readonly runner: DocumentJobRunner,
    config: ConfigService<Env, true>,
  ) {
    this.maxAttempts = config.get('PROCESSING_MAX_ATTEMPTS', { infer: true });
  }

  async handle(record: SQSRecord): Promise<SqsRecordOutcome> {
    const job = parseDocumentJob(record.body);
    if (!job) {
      // Reintentar no arregla un mensaje mal formado: se registra y se descarta.
      this.logger.error({
        event: 'document.job.invalid',
        messageId: record.messageId,
      });
      return 'processed';
    }
    const outcome = await this.runner.run({
      documentId: job.documentId,
      // SQS cuenta cuántas veces entregó el mensaje: es el número de intento.
      attempt: Number(record.attributes.ApproximateReceiveCount),
      maxAttempts: this.maxAttempts,
    });
    return outcome.kind === 'retry' ? 'retry' : 'processed';
  }
}

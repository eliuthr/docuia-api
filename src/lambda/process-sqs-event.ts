import { Logger } from '@nestjs/common';
import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from 'aws-lambda';
import { SqsDocumentConsumer } from '../processing/sqs-document.consumer.js';

const logger = new Logger('SqsWorker');

/**
 * Procesa los mensajes del lote y devuelve los que deben volver a la cola
 * ("partial batch response"): SQS borra el resto.
 */
export async function processSqsEvent(
  consumer: SqsDocumentConsumer,
  event: SQSEvent,
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];
  for (const record of event.Records) {
    if ((await handleSafely(consumer, record)) === 'retry') {
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}

/** Un error inesperado (por ejemplo, al marcar el documento) devuelve el mensaje a la cola. */
async function handleSafely(
  consumer: SqsDocumentConsumer,
  record: SQSEvent['Records'][number],
): Promise<'processed' | 'retry'> {
  try {
    return await consumer.handle(record);
  } catch (error) {
    logger.error({
      event: 'document.job.crashed',
      messageId: record.messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'retry';
  }
}

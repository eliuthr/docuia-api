import type { SQSRecord } from 'aws-lambda';

/** Mensaje de SQS como lo entrega Lambda, con lo que usa el worker. */
export function buildSqsRecord(
  body: string,
  receiveCount = 1,
  messageId = 'message-1',
): SQSRecord {
  return {
    messageId,
    body,
    attributes: { ApproximateReceiveCount: String(receiveCount) },
  } as unknown as SQSRecord;
}

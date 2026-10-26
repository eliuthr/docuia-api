import { Duration } from 'aws-cdk-lib';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

/** Igual que PROCESSING_MAX_ATTEMPTS en la API. */
export const PROCESSING_MAX_ATTEMPTS = 3;
const DEAD_LETTER_RETENTION = Duration.days(14);
/** AWS recomienda que el visibility timeout sea al menos 6 veces el timeout de la Lambda. */
const VISIBILITY_TIMEOUT_FACTOR = 6;

export interface ProcessingQueueProps {
  /** Timeout de la Lambda que consume la cola. */
  workerTimeout: Duration;
}

/**
 * Cola de trabajos y su cola de mensajes fallidos (DLQ). Un mensaje que no se
 * borra vuelve tras el visibility timeout; tras `maxReceiveCount` entregas pasa a la DLQ.
 */
export class ProcessingQueue extends Construct {
  readonly queue: Queue;
  readonly deadLetterQueue: Queue;

  constructor(scope: Construct, id: string, props: ProcessingQueueProps) {
    super(scope, id);
    this.deadLetterQueue = new Queue(this, 'DeadLetters', {
      retentionPeriod: DEAD_LETTER_RETENTION,
      encryption: QueueEncryption.SQS_MANAGED,
    });
    this.queue = new Queue(this, 'Jobs', {
      visibilityTimeout: Duration.seconds(
        props.workerTimeout.toSeconds() * VISIBILITY_TIMEOUT_FACTOR,
      ),
      encryption: QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        // Un intento más que el worker: así siempre puede marcar el documento como fallido.
        maxReceiveCount: PROCESSING_MAX_ATTEMPTS + 1,
      },
    });
  }
}

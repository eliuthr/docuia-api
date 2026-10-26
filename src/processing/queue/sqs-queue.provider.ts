import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import { requireConfig } from '../../config/require-config.js';
import { DocumentJob } from './document-job.js';
import { QueueProvider } from './queue.provider.js';

/**
 * Envía un mensaje por documento a la cola SQS. Los reintentos no se piden
 * aquí: los maneja la cola (visibility timeout y cola de mensajes fallidos).
 */
@Injectable()
export class SqsQueueProvider extends QueueProvider {
  private readonly queueUrl: string;

  constructor(
    private readonly sqs: SQSClient,
    config: ConfigService<Env, true>,
  ) {
    super();
    this.queueUrl = requireConfig(config, 'SQS_QUEUE_URL');
  }

  async enqueue(job: DocumentJob): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(job),
      }),
    );
  }
}

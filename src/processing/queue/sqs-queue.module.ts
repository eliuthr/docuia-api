import { Global, Module } from '@nestjs/common';
import { sqsClientProvider } from '../../common/aws/aws-clients.js';
import { QueueProvider } from './queue.provider.js';
import { SqsQueueProvider } from './sqs-queue.provider.js';

/** Global: lo importa QueueModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  providers: [
    sqsClientProvider,
    { provide: QueueProvider, useClass: SqsQueueProvider },
  ],
  exports: [QueueProvider],
})
export class SqsQueueModule {}

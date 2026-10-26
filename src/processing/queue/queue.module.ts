import { Module } from '@nestjs/common';
import { importForDriver } from '../../common/modules/import-for-driver.js';
import { BullmqQueueModule } from './bullmq-queue.module.js';
import { SqsQueueModule } from './sqs-queue.module.js';

/** Lado productor de la cola de procesamiento; lo usa la API. */
@Module({
  imports: [
    ...importForDriver('QUEUE_DRIVER', {
      bullmq: BullmqQueueModule,
      sqs: SqsQueueModule,
    }),
  ],
})
export class QueueModule {}

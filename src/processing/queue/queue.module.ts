import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { provideByDriver } from '../../common/providers/provide-by-driver.js';
import { Env } from '../../config/env.schema.js';
import { BullmqConnectionModule } from './bullmq-connection.module.js';
import { BullmqQueueProvider } from './bullmq-queue.provider.js';
import { DOCUMENT_PROCESSING_QUEUE } from './document-job.js';
import { QueueProvider } from './queue.provider.js';
import { redisConnection } from '../../common/redis/redis-connection.js';

/** Lado productor de la cola de procesamiento; lo usa la API. */
@Module({
  imports: [
    BullmqConnectionModule,
    BullModule.registerQueueAsync({
      name: DOCUMENT_PROCESSING_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        // Falla rápido si Redis está caído, en vez de dejar colgada la petición HTTP.
        connection: { ...redisConnection(config), enableOfflineQueue: false },
      }),
    }),
  ],
  providers: [
    provideByDriver(QueueProvider, 'QUEUE_DRIVER', {
      bullmq: BullmqQueueProvider,
    }),
  ],
  exports: [QueueProvider],
})
export class QueueModule {}

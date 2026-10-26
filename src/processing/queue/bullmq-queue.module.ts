import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redisConnection } from '../../common/redis/redis-connection.js';
import { Env } from '../../config/env.schema.js';
import { BullmqConnectionModule } from './bullmq-connection.module.js';
import { BullmqQueueProvider } from './bullmq-queue.provider.js';
import { DOCUMENT_PROCESSING_QUEUE } from './document-job.js';
import { QueueProvider } from './queue.provider.js';

/** Global: lo importa QueueModule de forma condicional (ver importForDriver). */
@Global()
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
  providers: [{ provide: QueueProvider, useClass: BullmqQueueProvider }],
  exports: [QueueProvider],
})
export class BullmqQueueModule {}

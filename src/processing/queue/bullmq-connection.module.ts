import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import { redisConnection } from './redis-connection.js';

/** Conexión de BullMQ compartida por la API (productor) y el worker (consumidor). */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: redisConnection(config),
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullmqConnectionModule {}

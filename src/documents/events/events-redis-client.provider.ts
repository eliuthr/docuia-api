import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Env } from '../../config/env.schema.js';
import { redisConnection } from '../../common/redis/redis-connection.js';
import { EVENTS_REDIS_CLIENT } from './document-status-event.js';

/**
 * Cliente de Redis propio de cada módulo de eventos: una conexión en modo
 * suscripción no puede ejecutar otros comandos, así que no se comparte.
 */
export const eventsRedisClientProvider: FactoryProvider<Redis> = {
  provide: EVENTS_REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    new Redis(redisConnection(config)),
};

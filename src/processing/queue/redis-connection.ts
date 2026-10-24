import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';

export interface RedisConnection {
  host: string;
  port: number;
}

export function redisConnection(
  config: ConfigService<Env, true>,
): RedisConnection {
  return {
    host: config.get('REDIS_HOST', { infer: true }),
    port: config.get('REDIS_PORT', { infer: true }),
  };
}

import { ConsoleLogger } from '@nestjs/common';

export const LOG_FORMATS = ['pretty', 'json'] as const;

/**
 * Logger de la app. En AWS se usa JSON (una línea por log) para poder filtrar
 * por campos en CloudWatch. Se lee antes de que exista ConfigService, porque
 * el logger se crea junto con la app; la variable igual se valida al arrancar.
 */
export function createAppLogger(): ConsoleLogger {
  return new ConsoleLogger({ json: process.env.LOG_FORMAT === 'json' });
}

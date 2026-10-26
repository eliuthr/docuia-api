import { ConfigService } from '@nestjs/config';
import { Env } from './env.schema.js';

type OptionalKey = {
  [Key in keyof Env]-?: undefined extends Env[Key] ? Key : never;
}[keyof Env];

/**
 * Lee una variable que solo es obligatoria con cierto driver. La validación
 * del arranque ya garantiza que existe; esto evita usar `!` en cada lectura.
 */
export function requireConfig<Key extends OptionalKey>(
  config: ConfigService<Env, true>,
  key: Key,
): NonNullable<Env[Key]> {
  const value = config.get(key, { infer: true });
  if (value === undefined || value === null) {
    throw new Error(`Missing configuration: ${key}`);
  }
  return value as NonNullable<Env[Key]>;
}

import { Abstract, FactoryProvider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Env } from '../../config/env.schema.js';

type DriverKey = {
  [Key in keyof Env]-?: Env[Key] extends string ? Key : never;
}[keyof Env];

/**
 * Enlaza una abstracción con la implementación que indica una variable de driver.
 * `moduleRef.create` construye solo la clase elegida y resuelve sus
 * dependencias; `moduleRef.get` podría devolver una instancia aún sin construir.
 */
export function provideByDriver<T, Key extends DriverKey>(
  token: Abstract<T>,
  driverKey: Key,
  implementations: Record<Env[Key], Type<T>>,
): FactoryProvider<Promise<T>> {
  return {
    provide: token,
    inject: [ConfigService, ModuleRef],
    useFactory: (config: ConfigService<Env, true>, moduleRef: ModuleRef) =>
      moduleRef.create(implementations[config.get(driverKey, { infer: true })]),
  };
}

import { DynamicModule, ForwardReference, Type } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import { DEFAULT_DRIVERS, Env } from '../../config/env.schema.js';

type DriverVariable = keyof typeof DEFAULT_DRIVERS;
type ModuleImport = Type | DynamicModule | ForwardReference;

/**
 * Importa solo el módulo del driver elegido; los demás ni se cargan, así que
 * no abren conexiones (por ejemplo, Mongo o Redis en AWS). Los módulos de cada
 * driver son `@Global()`: Nest no permite reexportar lo que llega en un import
 * asíncrono, y así sus providers quedan disponibles para quien los use.
 */
export function importForDriver<Key extends DriverVariable>(
  driverVariable: Key,
  modulesByDriver: Partial<Record<Env[Key], ModuleImport>>,
): Promise<DynamicModule>[] {
  return Object.entries(modulesByDriver).map(([driver, module]) =>
    ConditionalModule.registerWhen(
      module as ModuleImport,
      (env) => selectedDriver(env, driverVariable) === driver,
      { debug: false },
    ),
  );
}

/** El valor ya validado está en `process.env`; si falta, se usa el del entorno local. */
export function selectedDriver(
  env: NodeJS.ProcessEnv,
  driverVariable: DriverVariable,
): string {
  return env[driverVariable] ?? DEFAULT_DRIVERS[driverVariable];
}

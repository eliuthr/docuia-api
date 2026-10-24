import { Module, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Env, StorageDriver } from '../config/env.schema.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import { StorageProvider } from './storage.provider.js';

const STORAGE_IMPLEMENTATIONS: Record<StorageDriver, Type<StorageProvider>> = {
  local: LocalStorageProvider,
};

@Module({
  providers: [
    {
      provide: StorageProvider,
      inject: [ConfigService, ModuleRef],
      // `create` builds only the selected implementation and resolves its
      // dependencies; `get` could return a not-yet-constructed instance.
      useFactory: (config: ConfigService<Env, true>, moduleRef: ModuleRef) =>
        moduleRef.create(
          STORAGE_IMPLEMENTATIONS[
            config.get('STORAGE_DRIVER', { infer: true })
          ],
        ),
    },
  ],
  exports: [StorageProvider],
})
export class StorageModule {}

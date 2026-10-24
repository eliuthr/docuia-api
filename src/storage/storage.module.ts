import { Module } from '@nestjs/common';
import { provideByDriver } from '../common/providers/provide-by-driver.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import { StorageProvider } from './storage.provider.js';

@Module({
  providers: [
    provideByDriver(StorageProvider, 'STORAGE_DRIVER', {
      local: LocalStorageProvider,
    }),
  ],
  exports: [StorageProvider],
})
export class StorageModule {}

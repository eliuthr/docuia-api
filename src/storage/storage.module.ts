import { Module } from '@nestjs/common';
import { s3ClientProvider } from '../common/aws/aws-clients.js';
import { provideByDriver } from '../common/providers/provide-by-driver.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import { S3StorageProvider } from './s3-storage.provider.js';
import { StorageProvider } from './storage.provider.js';

@Module({
  providers: [
    // Crear el cliente de S3 no abre conexiones, así que no hace falta cargarlo de forma condicional.
    s3ClientProvider,
    provideByDriver(StorageProvider, 'STORAGE_DRIVER', {
      local: LocalStorageProvider,
      s3: S3StorageProvider,
    }),
  ],
  exports: [StorageProvider],
})
export class StorageModule {}

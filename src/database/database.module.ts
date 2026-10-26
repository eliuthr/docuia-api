import { Module } from '@nestjs/common';
import { importForDriver } from '../common/modules/import-for-driver.js';
import { MongoDatabaseModule } from './mongo-database.module.js';

/**
 * Conexión de base de datos del driver elegido. DynamoDB no necesita una
 * conexión previa: cada repositorio usa su cliente del SDK.
 */
@Module({
  imports: [
    ...importForDriver('DATABASE_DRIVER', { mongodb: MongoDatabaseModule }),
  ],
})
export class DatabaseModule {}

import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ProcessingModule } from './processing/processing.module.js';

/** Módulo raíz del proceso worker: sin capa HTTP, solo consumidores de la cola. */
@Module({
  imports: [AppConfigModule, DatabaseModule, ProcessingModule],
})
export class WorkerModule {}

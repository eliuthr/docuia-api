import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { Env } from '../config/env.schema.js';
import { QueueModule } from '../processing/queue/queue.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { BYTES_PER_MEGABYTE } from './documents.constants.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { DocumentPersistenceModule } from './repositories/document-persistence.module.js';

const MAX_FILES_PER_UPLOAD = 1;

@Module({
  imports: [
    StorageModule,
    DocumentPersistenceModule,
    QueueModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        limits: {
          fileSize:
            config.get('MAX_UPLOAD_SIZE_MB', { infer: true }) *
            BYTES_PER_MEGABYTE,
          files: MAX_FILES_PER_UPLOAD,
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}

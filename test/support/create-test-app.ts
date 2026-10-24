import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { DatabaseModule } from '../../src/database/database.module.js';
import { DocumentPersistenceModule } from '../../src/documents/repositories/document-persistence.module.js';
import {
  InMemoryDocumentPersistenceModule,
  NoDatabaseModule,
} from './in-memory-document.repository.js';

/** Boots the full app without MongoDB, using in-memory persistence. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(DatabaseModule)
    .useModule(NoDatabaseModule)
    .overrideModule(DocumentPersistenceModule)
    .useModule(InMemoryDocumentPersistenceModule)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

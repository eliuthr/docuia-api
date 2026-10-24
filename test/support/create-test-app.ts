import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LlmProvider } from '../../src/ai/llm/llm.provider.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { DatabaseModule } from '../../src/database/database.module.js';
import { DocumentPersistenceModule } from '../../src/documents/repositories/document-persistence.module.js';
import { QueueModule } from '../../src/processing/queue/queue.module.js';
import {
  InMemoryDocumentPersistenceModule,
  NoDatabaseModule,
} from './in-memory-document.repository.js';
import { InMemoryQueueModule } from './in-memory-queue.provider.js';
import { ScriptedLlmProvider } from './scripted-llm.provider.js';

/** Arranca la app completa sin MongoDB, Redis ni LLM real, con dobles en memoria. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(DatabaseModule)
    .useModule(NoDatabaseModule)
    .overrideModule(DocumentPersistenceModule)
    .useModule(InMemoryDocumentPersistenceModule)
    .overrideModule(QueueModule)
    .useModule(InMemoryQueueModule)
    .overrideProvider(LlmProvider)
    .useValue(new ScriptedLlmProvider())
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

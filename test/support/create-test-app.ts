import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LlmProvider } from '../../src/ai/llm/llm.provider.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { ConversationPersistenceModule } from '../../src/conversations/repositories/conversation-persistence.module.js';
import { DatabaseModule } from '../../src/database/database.module.js';
import { DocumentEventsSubscriberModule } from '../../src/documents/events/document-events-subscriber.module.js';
import { DocumentPersistenceModule } from '../../src/documents/repositories/document-persistence.module.js';
import { QueueModule } from '../../src/processing/queue/queue.module.js';
import {
  InMemoryDocumentPersistenceModule,
  NoDatabaseModule,
} from './in-memory-document.repository.js';
import { InMemoryConversationPersistenceModule } from './in-memory-conversation.repository.js';
import { InMemoryDocumentEventsModule } from './in-memory-document-events.js';
import { InMemoryQueueModule } from './in-memory-queue.provider.js';
import { ScriptedLlmProvider } from './scripted-llm.provider.js';

/**
 * Arranca la app completa sin MongoDB, Redis (cola y eventos) ni LLM real, con
 * dobles en memoria. `eventsModule` permite probar otro driver de eventos.
 */
export async function createTestApp(
  eventsModule: Type = InMemoryDocumentEventsModule,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(DatabaseModule)
    .useModule(NoDatabaseModule)
    .overrideModule(DocumentPersistenceModule)
    .useModule(InMemoryDocumentPersistenceModule)
    .overrideModule(ConversationPersistenceModule)
    .useModule(InMemoryConversationPersistenceModule)
    .overrideModule(QueueModule)
    .useModule(InMemoryQueueModule)
    .overrideModule(DocumentEventsSubscriberModule)
    .useModule(eventsModule)
    .overrideProvider(LlmProvider)
    .useValue(new ScriptedLlmProvider())
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

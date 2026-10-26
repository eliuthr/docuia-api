import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConversationMessageRecord,
  ConversationMessageRecordSchema,
} from '../schemas/conversation-message-record.schema.js';
import {
  ConversationRecord,
  ConversationRecordSchema,
} from '../schemas/conversation-record.schema.js';
import { ConversationRepository } from './conversation.repository.js';
import { MongoConversationRepository } from './mongo-conversation.repository.js';

/** Global: lo importa ConversationPersistenceModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationRecord.name, schema: ConversationRecordSchema },
      {
        name: ConversationMessageRecord.name,
        schema: ConversationMessageRecordSchema,
      },
    ]),
  ],
  providers: [
    { provide: ConversationRepository, useClass: MongoConversationRepository },
  ],
  exports: [ConversationRepository],
})
export class MongoConversationPersistenceModule {}

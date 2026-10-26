import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { ConversationPersistenceModule } from './repositories/conversation-persistence.module.js';

/** Historial de preguntas y respuestas; no depende del módulo de IA. */
@Module({
  imports: [ConversationPersistenceModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}

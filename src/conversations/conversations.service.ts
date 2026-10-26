import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CONVERSATION_LIST_LIMIT,
  CONVERSATION_TITLE_LENGTH,
  MAX_CONVERSATION_MESSAGES,
  MAX_HISTORY_MESSAGES,
} from './conversations.constants.js';
import { ConversationScope, isSameScope } from './domain/conversation-scope.js';
import {
  ConversationEntity,
  ConversationMessage,
} from './domain/conversation.entity.js';
import { ConversationRepository } from './repositories/conversation.repository.js';

export interface ConversationWithMessages {
  conversation: ConversationEntity;
  messages: ConversationMessage[];
}

/** Una pregunta con su respuesta final, tal como se guarda en el historial. */
export interface ConversationExchange {
  question: string;
  answer: string;
  askedAt: Date;
  answeredAt: Date;
}

@Injectable()
export class ConversationsService {
  constructor(private readonly repository: ConversationRepository) {}

  /**
   * Devuelve la conversación donde se guardará la pregunta: la indicada por el
   * cliente (validada) o una nueva si no indicó ninguna.
   */
  async openForQuestion(
    scope: ConversationScope,
    question: string,
    conversationId?: string,
  ): Promise<ConversationEntity> {
    if (!conversationId) {
      return this.repository.create({
        id: randomUUID(),
        scope,
        title: question.slice(0, CONVERSATION_TITLE_LENGTH),
      });
    }
    const conversation = await this.getConversation(conversationId);
    assertCanContinue(conversation, scope);
    return conversation;
  }

  /** El historial reciente que se le envía al modelo, del más antiguo al más reciente. */
  recentMessages(conversationId: string): Promise<ConversationMessage[]> {
    return this.repository.findRecentMessages(
      conversationId,
      MAX_HISTORY_MESSAGES,
    );
  }

  appendExchange(
    conversationId: string,
    exchange: ConversationExchange,
  ): Promise<void> {
    return this.repository.appendMessages(conversationId, [
      { role: 'user', text: exchange.question, createdAt: exchange.askedAt },
      {
        role: 'assistant',
        text: exchange.answer,
        createdAt: exchange.answeredAt,
      },
    ]);
  }

  list(scope: ConversationScope): Promise<ConversationEntity[]> {
    return this.repository.listByScope(scope, CONVERSATION_LIST_LIMIT);
  }

  async findWithMessages(id: string): Promise<ConversationWithMessages> {
    const conversation = await this.getConversation(id);
    const messages = await this.repository.findAllMessages(id);
    return { conversation, messages };
  }

  private async getConversation(id: string): Promise<ConversationEntity> {
    const conversation = await this.repository.findById(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conversation;
  }
}

function assertCanContinue(
  conversation: ConversationEntity,
  scope: ConversationScope,
): void {
  if (!isSameScope(conversation.scope, scope)) {
    throw new BadRequestException(
      'The conversation belongs to another document or to the collection.',
    );
  }
  if (conversation.messageCount >= MAX_CONVERSATION_MESSAGES) {
    throw new ConflictException(
      'The conversation is full. Start a new conversation.',
    );
  }
}

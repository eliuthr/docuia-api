import { Module } from '@nestjs/common';
import {
  ConversationScope,
  isSameScope,
} from '../../src/conversations/domain/conversation-scope.js';
import {
  ConversationEntity,
  ConversationMessage,
  NewConversation,
} from '../../src/conversations/domain/conversation.entity.js';
import { ConversationRepository } from '../../src/conversations/repositories/conversation.repository.js';

export class InMemoryConversationRepository extends ConversationRepository {
  private readonly conversations = new Map<string, ConversationEntity>();
  private readonly messages = new Map<string, ConversationMessage[]>();

  create(conversation: NewConversation): Promise<ConversationEntity> {
    const now = new Date();
    const entity = {
      ...conversation,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(entity.id, entity);
    this.messages.set(entity.id, []);
    return Promise.resolve(entity);
  }

  findById(id: string): Promise<ConversationEntity | null> {
    return Promise.resolve(this.conversations.get(id) ?? null);
  }

  listByScope(
    scope: ConversationScope,
    limit: number,
  ): Promise<ConversationEntity[]> {
    const matches = [...this.conversations.values()]
      .filter(
        (conversation) =>
          conversation.messageCount > 0 &&
          isSameScope(conversation.scope, scope),
      )
      .sort((first, second) => {
        return second.updatedAt.getTime() - first.updatedAt.getTime();
      });
    return Promise.resolve(matches.slice(0, limit));
  }

  findRecentMessages(
    id: string,
    limit: number,
  ): Promise<ConversationMessage[]> {
    return Promise.resolve((this.messages.get(id) ?? []).slice(-limit));
  }

  findAllMessages(id: string): Promise<ConversationMessage[]> {
    return Promise.resolve([...(this.messages.get(id) ?? [])]);
  }

  appendMessages(id: string, messages: ConversationMessage[]): Promise<void> {
    const current = this.conversations.get(id);
    if (!current) {
      return Promise.resolve();
    }
    this.messages.get(id)?.push(...messages);
    this.conversations.set(id, {
      ...current,
      messageCount: current.messageCount + messages.length,
      updatedAt: new Date(),
    });
    return Promise.resolve();
  }
}

@Module({
  providers: [
    {
      provide: ConversationRepository,
      useClass: InMemoryConversationRepository,
    },
  ],
  exports: [ConversationRepository],
})
export class InMemoryConversationPersistenceModule {}

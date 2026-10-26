import { ConversationScope } from '../domain/conversation-scope.js';
import {
  ConversationEntity,
  ConversationMessage,
  NewConversation,
} from '../domain/conversation.entity.js';

/**
 * Puerto de persistencia de conversaciones. Los mensajes se guardan aparte de
 * la conversación para que ninguna crezca como un solo registro enorme
 * (DynamoDB limita cada ítem a 400 KB).
 */
export abstract class ConversationRepository {
  abstract create(conversation: NewConversation): Promise<ConversationEntity>;
  abstract findById(id: string): Promise<ConversationEntity | null>;
  /** Conversaciones con al menos un mensaje, de la más reciente a la más antigua. */
  abstract listByScope(
    scope: ConversationScope,
    limit: number,
  ): Promise<ConversationEntity[]>;
  /** Los últimos `limit` mensajes, del más antiguo al más reciente. */
  abstract findRecentMessages(
    id: string,
    limit: number,
  ): Promise<ConversationMessage[]>;
  /** Todos los mensajes, del más antiguo al más reciente. */
  abstract findAllMessages(id: string): Promise<ConversationMessage[]>;
  /** Agrega los mensajes, suma `messageCount` y actualiza `updatedAt`. */
  abstract appendMessages(
    id: string,
    messages: ConversationMessage[],
  ): Promise<void>;
}

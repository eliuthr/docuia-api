import {
  ConversationScope,
  scopeDocumentId,
  scopeFromDocumentId,
} from '../domain/conversation-scope.js';
import {
  ConversationEntity,
  ConversationMessage,
  ConversationRole,
} from '../domain/conversation.entity.js';

/** Índice que agrupa las conversaciones por alcance y las ordena por actividad. */
export const CONVERSATIONS_BY_SCOPE_INDEX = 'byScope';
/** Partición del índice para las conversaciones sobre toda la colección. */
const COLLECTION_SCOPE_KEY = 'COLLECTION';

export interface ConversationItem {
  id: string;
  scopeKey: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Un mensaje por item: la clave es la conversación y el número de mensaje. */
export interface MessageItem {
  conversationId: string;
  sequence: number;
  role: ConversationRole;
  text: string;
  createdAt: string;
}

export function scopeKeyOf(scope: ConversationScope): string {
  return scopeDocumentId(scope) ?? COLLECTION_SCOPE_KEY;
}

export function toConversationItem(
  conversation: ConversationEntity,
): ConversationItem {
  return {
    id: conversation.id,
    scopeKey: scopeKeyOf(conversation.scope),
    title: conversation.title,
    messageCount: conversation.messageCount,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function toConversationEntity(
  item: ConversationItem,
): ConversationEntity {
  const documentId =
    item.scopeKey === COLLECTION_SCOPE_KEY ? null : item.scopeKey;
  return {
    id: item.id,
    scope: scopeFromDocumentId(documentId),
    title: item.title,
    messageCount: item.messageCount,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export function toMessageItem(
  conversationId: string,
  sequence: number,
  message: ConversationMessage,
): MessageItem {
  return {
    conversationId,
    sequence,
    role: message.role,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toConversationMessage(item: MessageItem): ConversationMessage {
  return {
    role: item.role,
    text: item.text,
    createdAt: new Date(item.createdAt),
  };
}

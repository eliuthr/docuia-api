import { ConversationScope } from './conversation-scope.js';

export interface ConversationEntity {
  id: string;
  scope: ConversationScope;
  /** La primera pregunta, recortada. */
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type NewConversation = Pick<
  ConversationEntity,
  'id' | 'scope' | 'title'
>;

export const CONVERSATION_ROLES = ['user', 'assistant'] as const;

export type ConversationRole = (typeof CONVERSATION_ROLES)[number];

/** Solo se guardan las preguntas y las respuestas finales, no las llamadas a herramientas. */
export interface ConversationMessage {
  role: ConversationRole;
  text: string;
  createdAt: Date;
}

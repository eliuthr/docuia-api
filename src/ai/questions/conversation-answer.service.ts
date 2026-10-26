import { Injectable } from '@nestjs/common';
import { ConversationsService } from '../../conversations/conversations.service.js';
import { ConversationMessage } from '../../conversations/domain/conversation.entity.js';
import { QuestionAgentService } from '../agent/question-agent.service.js';
import { ConversationItem } from '../llm/conversation.js';
import { AnswerEvent } from './answer-event.js';

export interface ConversationAnswerRequest {
  conversationId: string;
  logContext: Record<string, string>;
  instructions: string;
  question: string;
  signal: AbortSignal;
}

/**
 * Responde dentro de una conversación: le da al agente el historial reciente
 * y, solo si la respuesta termina, guarda la pregunta y la respuesta.
 */
@Injectable()
export class ConversationAnswerService {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly agent: QuestionAgentService,
  ) {}

  async *answer(
    request: ConversationAnswerRequest,
  ): AsyncGenerator<AnswerEvent> {
    const { conversationId, question } = request;
    yield { type: 'conversation', id: conversationId };
    const askedAt = new Date();
    const messages = await this.conversations.recentMessages(conversationId);
    const answer = yield* this.agent.run({
      logContext: request.logContext,
      instructions: request.instructions,
      history: messages.map(toConversationItem),
      question,
      signal: request.signal,
    });
    await this.conversations.appendExchange(conversationId, {
      question,
      answer,
      askedAt,
      answeredAt: new Date(),
    });
    yield { type: 'done' };
  }
}

function toConversationItem(message: ConversationMessage): ConversationItem {
  return message.role === 'user'
    ? { kind: 'user_message', text: message.text }
    : { kind: 'assistant_message', text: message.text };
}

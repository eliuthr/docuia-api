import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationsService } from '../../conversations/conversations.service.js';
import {
  COLLECTION_SCOPE,
  documentScope,
} from '../../conversations/domain/conversation-scope.js';
import { DocumentStatus } from '../../documents/domain/document-status.enum.js';
import { DocumentEntity } from '../../documents/domain/document.entity.js';
import { DocumentRepository } from '../../documents/repositories/document.repository.js';
import { ANSWER_COLLECTION_QUESTION_PROMPT } from '../prompts/answer-collection-question.prompt.js';
import { buildDocumentQuestionPrompt } from '../prompts/answer-document-question.prompt.js';
import { AnswerEvent } from './answer-event.js';
import { ConversationAnswerService } from './conversation-answer.service.js';

export interface QuestionInput {
  question: string;
  /** Conversación que se continúa; sin ella se empieza una nueva. */
  conversationId?: string;
}

/**
 * Prepara cada tipo de pregunta (validaciones, conversación y prompt) y
 * delega la respuesta. Todo lo que puede fallar con un error HTTP (404, 400,
 * 409) se resuelve antes de devolver el stream.
 */
@Injectable()
export class QuestionAnsweringService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly conversations: ConversationsService,
    private readonly conversationAnswer: ConversationAnswerService,
  ) {}

  async answerAboutDocument(
    documentId: string,
    input: QuestionInput,
    signal: AbortSignal,
  ): Promise<AsyncIterable<AnswerEvent>> {
    const document = await this.findReadyDocument(documentId);
    const conversation = await this.conversations.openForQuestion(
      documentScope(documentId),
      input.question,
      input.conversationId,
    );
    return this.conversationAnswer.answer({
      conversationId: conversation.id,
      logContext: {
        endpoint: 'documents.ask',
        documentId,
        conversationId: conversation.id,
      },
      instructions: buildDocumentQuestionPrompt({
        id: document.id,
        name: document.originalName,
        documentType: document.documentType,
      }),
      question: input.question,
      signal,
    });
  }

  async answerAboutCollection(
    input: QuestionInput,
    signal: AbortSignal,
  ): Promise<AsyncIterable<AnswerEvent>> {
    const conversation = await this.conversations.openForQuestion(
      COLLECTION_SCOPE,
      input.question,
      input.conversationId,
    );
    return this.conversationAnswer.answer({
      conversationId: conversation.id,
      logContext: { endpoint: 'ask', conversationId: conversation.id },
      instructions: ANSWER_COLLECTION_QUESTION_PROMPT,
      question: input.question,
      signal,
    });
  }

  private async findReadyDocument(documentId: string): Promise<DocumentEntity> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (document.status !== DocumentStatus.Ready) {
      throw new ConflictException(
        'The document is still being processed or failed. Ask again when it is ready.',
      );
    }
    return document;
  }
}

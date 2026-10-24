import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus } from '../../documents/domain/document-status.enum.js';
import { DocumentRepository } from '../../documents/repositories/document.repository.js';
import { ANSWER_COLLECTION_QUESTION_PROMPT } from '../prompts/answer-collection-question.prompt.js';
import { buildDocumentQuestionPrompt } from '../prompts/answer-document-question.prompt.js';
import { AnswerEvent } from './answer-event.js';
import { ToolLoopService } from './tool-loop.service.js';

/** Prepara cada tipo de pregunta (prompt y validaciones) y delega en el bucle de herramientas. */
@Injectable()
export class QuestionAnsweringService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly toolLoop: ToolLoopService,
  ) {}

  /**
   * Valida el documento antes de devolver el stream, para que los 404 y 409
   * se respondan como errores HTTP normales y no a mitad de la transmisión.
   */
  async answerAboutDocument(
    documentId: string,
    question: string,
    signal: AbortSignal,
  ): Promise<AsyncIterable<AnswerEvent>> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (document.status !== DocumentStatus.Ready) {
      throw new ConflictException(
        'The document is still being processed or failed. Ask again when it is ready.',
      );
    }

    return this.toolLoop.run({
      logContext: { endpoint: 'documents.ask', documentId },
      instructions: buildDocumentQuestionPrompt({
        id: document.id,
        name: document.originalName,
        documentType: document.documentType,
      }),
      question,
      signal,
    });
  }

  answerAboutCollection(
    question: string,
    signal: AbortSignal,
  ): AsyncIterable<AnswerEvent> {
    return this.toolLoop.run({
      logContext: { endpoint: 'ask' },
      instructions: ANSWER_COLLECTION_QUESTION_PROMPT,
      question,
      signal,
    });
  }
}

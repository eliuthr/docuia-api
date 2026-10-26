import { ConflictException, NotFoundException } from '@nestjs/common';
import { buildDocument } from '../../../test/support/build-document.js';
import { ConversationsService } from '../../conversations/conversations.service.js';
import {
  COLLECTION_SCOPE,
  documentScope,
} from '../../conversations/domain/conversation-scope.js';
import { DocumentStatus } from '../../documents/domain/document-status.enum.js';
import { DocumentRepository } from '../../documents/repositories/document.repository.js';
import { ANSWER_COLLECTION_QUESTION_PROMPT } from '../prompts/answer-collection-question.prompt.js';
import { ConversationAnswerService } from './conversation-answer.service.js';
import { QuestionAnsweringService } from './question-answering.service.js';

const QUESTION = '¿Cuál es el total?';

describe('QuestionAnsweringService', () => {
  let findById: ReturnType<typeof vi.fn>;
  let openForQuestion: ReturnType<typeof vi.fn>;
  let answer: ReturnType<typeof vi.fn>;
  let service: QuestionAnsweringService;
  const signal = new AbortController().signal;

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue(buildDocument());
    openForQuestion = vi.fn().mockResolvedValue({ id: 'conv-1' });
    answer = vi.fn().mockReturnValue('answer-stream');
    service = new QuestionAnsweringService(
      { findById } as unknown as DocumentRepository,
      { openForQuestion } as unknown as ConversationsService,
      { answer } as unknown as ConversationAnswerService,
    );
  });

  describe('answerAboutDocument', () => {
    it('answers in a document conversation with a prompt that names the document', async () => {
      await expect(
        service.answerAboutDocument(
          'doc-1',
          { question: QUESTION, conversationId: 'conv-1' },
          signal,
        ),
      ).resolves.toBe('answer-stream');

      expect(openForQuestion).toHaveBeenCalledWith(
        documentScope('doc-1'),
        QUESTION,
        'conv-1',
      );
      const [request] = answer.mock.calls[0] as [{ instructions: string }];
      expect(request).toMatchObject({
        conversationId: 'conv-1',
        logContext: {
          endpoint: 'documents.ask',
          documentId: 'doc-1',
          conversationId: 'conv-1',
        },
        question: QUESTION,
        signal,
      });
      expect(request.instructions).toContain('"id":"doc-1"');
      expect(request.instructions).toContain('"name":"factura.pdf"');
    });

    it('throws NotFoundException for a missing document', async () => {
      findById.mockResolvedValue(null);

      await expect(
        service.answerAboutDocument('doc-9', { question: QUESTION }, signal),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(openForQuestion).not.toHaveBeenCalled();
      expect(answer).not.toHaveBeenCalled();
    });

    it('throws ConflictException for a document that is not ready', async () => {
      findById.mockResolvedValue(
        buildDocument({ status: DocumentStatus.Processing }),
      );

      await expect(
        service.answerAboutDocument('doc-1', { question: QUESTION }, signal),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects before streaming when the conversation cannot be continued', async () => {
      openForQuestion.mockRejectedValue(new NotFoundException());

      await expect(
        service.answerAboutDocument(
          'doc-1',
          { question: QUESTION, conversationId: 'conv-9' },
          signal,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(answer).not.toHaveBeenCalled();
    });
  });

  describe('answerAboutCollection', () => {
    it('answers in a collection conversation with the collection prompt', async () => {
      await service.answerAboutCollection({ question: QUESTION }, signal);

      expect(openForQuestion).toHaveBeenCalledWith(
        COLLECTION_SCOPE,
        QUESTION,
        undefined,
      );
      expect(answer).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        logContext: { endpoint: 'ask', conversationId: 'conv-1' },
        instructions: ANSWER_COLLECTION_QUESTION_PROMPT,
        question: QUESTION,
        signal,
      });
    });
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { buildDocument } from '../../../test/support/build-document.js';
import { DocumentStatus } from '../../documents/domain/document-status.enum.js';
import { DocumentRepository } from '../../documents/repositories/document.repository.js';
import { ANSWER_COLLECTION_QUESTION_PROMPT } from '../prompts/answer-collection-question.prompt.js';
import { QuestionAnsweringService } from './question-answering.service.js';
import { ToolLoopService } from './tool-loop.service.js';

const QUESTION = '¿Cuál es el total?';

describe('QuestionAnsweringService', () => {
  let findById: ReturnType<typeof vi.fn>;
  let run: ReturnType<typeof vi.fn>;
  let service: QuestionAnsweringService;
  const signal = new AbortController().signal;

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue(buildDocument());
    run = vi.fn().mockReturnValue('answer-stream');
    service = new QuestionAnsweringService(
      { findById } as unknown as DocumentRepository,
      { run } as unknown as ToolLoopService,
    );
  });

  describe('answerAboutDocument', () => {
    it('runs the tool loop with a prompt that names the document', async () => {
      await expect(
        service.answerAboutDocument('doc-1', QUESTION, signal),
      ).resolves.toBe('answer-stream');

      const [request] = run.mock.calls[0] as [{ instructions: string }];
      expect(request).toMatchObject({
        logContext: { endpoint: 'documents.ask', documentId: 'doc-1' },
        question: QUESTION,
        signal,
      });
      expect(request.instructions).toContain('"id":"doc-1"');
      expect(request.instructions).toContain('"name":"factura.pdf"');
    });

    it('throws NotFoundException for a missing document', async () => {
      findById.mockResolvedValue(null);

      await expect(
        service.answerAboutDocument('doc-9', QUESTION, signal),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(run).not.toHaveBeenCalled();
    });

    it('throws ConflictException for a document that is not ready', async () => {
      findById.mockResolvedValue(
        buildDocument({ status: DocumentStatus.Processing }),
      );

      await expect(
        service.answerAboutDocument('doc-1', QUESTION, signal),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('answerAboutCollection', () => {
    it('runs the tool loop with the collection prompt', () => {
      service.answerAboutCollection(QUESTION, signal);

      expect(run).toHaveBeenCalledWith({
        logContext: { endpoint: 'ask' },
        instructions: ANSWER_COLLECTION_QUESTION_PROMPT,
        question: QUESTION,
        signal,
      });
    });
  });
});

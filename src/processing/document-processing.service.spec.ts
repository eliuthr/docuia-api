import { Logger } from '@nestjs/common';
import { DocumentStatus } from '../documents/domain/document-status.enum.js';
import { DocumentEntity } from '../documents/domain/document.entity.js';
import { DocumentRepository } from '../documents/repositories/document.repository.js';
import { StorageProvider } from '../storage/storage.provider.js';
import { DocumentProcessingService } from './document-processing.service.js';
import { UnreadableDocumentError } from './errors/unreadable-document.error.js';
import { TextExtractor } from './extraction/text-extractor.js';
import { TextExtractorRegistry } from './extraction/text-extractor.registry.js';

const DOCUMENT_ID = 'doc-1';

function buildDocument(
  overrides: Partial<DocumentEntity> = {},
): DocumentEntity {
  const now = new Date('2026-10-23T18:00:00.000Z');
  return {
    id: DOCUMENT_ID,
    originalName: 'invoice.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 100,
    storageKey: `${DOCUMENT_ID}.pdf`,
    status: DocumentStatus.Pending,
    textStorageKey: null,
    pageCount: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('DocumentProcessingService', () => {
  let repository: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let storage: {
    read: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let extractor: { extract: ReturnType<typeof vi.fn> };
  let registry: { forMimeType: ReturnType<typeof vi.fn> };
  let service: DocumentProcessingService;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    repository = {
      findById: vi.fn().mockResolvedValue(buildDocument()),
      update: vi.fn().mockResolvedValue(buildDocument()),
    };
    storage = {
      read: vi.fn().mockResolvedValue(Buffer.from('%PDF')),
      save: vi.fn().mockResolvedValue(undefined),
    };
    extractor = {
      extract: vi.fn().mockResolvedValue({ text: 'Total 150', pageCount: 2 }),
    };
    registry = {
      forMimeType: vi.fn((mimeType: string) =>
        mimeType === 'application/pdf'
          ? (extractor as unknown as TextExtractor)
          : null,
      ),
    };
    service = new DocumentProcessingService(
      repository as unknown as DocumentRepository,
      storage as unknown as StorageProvider,
      registry as unknown as TextExtractorRegistry,
    );
  });

  describe('process', () => {
    it('marks the document processing, stores the text and marks it ready', async () => {
      await service.process(DOCUMENT_ID);

      expect(repository.update).toHaveBeenNthCalledWith(1, DOCUMENT_ID, {
        status: DocumentStatus.Processing,
      });
      expect(storage.read).toHaveBeenCalledWith(`${DOCUMENT_ID}.pdf`);
      expect(storage.save).toHaveBeenCalledWith(
        `${DOCUMENT_ID}.txt`,
        Buffer.from('Total 150', 'utf8'),
      );
      expect(repository.update).toHaveBeenNthCalledWith(2, DOCUMENT_ID, {
        status: DocumentStatus.Ready,
        textStorageKey: `${DOCUMENT_ID}.txt`,
        pageCount: 2,
        failureReason: null,
      });
    });

    it('marks an image ready without extracting text', async () => {
      repository.findById.mockResolvedValue(
        buildDocument({ mimeType: 'image/png', storageKey: 'doc-1.png' }),
      );

      await service.process(DOCUMENT_ID);

      expect(storage.read).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenLastCalledWith(DOCUMENT_ID, {
        status: DocumentStatus.Ready,
        textStorageKey: null,
        pageCount: null,
        failureReason: null,
      });
    });

    it('treats a PDF without text as ready, not as an error', async () => {
      extractor.extract.mockResolvedValue({ text: '', pageCount: 1 });

      await service.process(DOCUMENT_ID);

      expect(repository.update).toHaveBeenLastCalledWith(
        DOCUMENT_ID,
        expect.objectContaining({ status: DocumentStatus.Ready, pageCount: 1 }),
      );
    });

    it('discards the job when the document no longer exists', async () => {
      repository.findById.mockResolvedValue(null);

      await service.process(DOCUMENT_ID);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it.each([DocumentStatus.Ready, DocumentStatus.Failed])(
      'skips a document that is already %s',
      async (status) => {
        repository.findById.mockResolvedValue(buildDocument({ status }));

        await service.process(DOCUMENT_ID);

        expect(repository.update).not.toHaveBeenCalled();
      },
    );

    it('resumes a document left in processing by a previous attempt', async () => {
      repository.findById.mockResolvedValue(
        buildDocument({ status: DocumentStatus.Processing }),
      );

      await service.process(DOCUMENT_ID);

      expect(repository.update).toHaveBeenLastCalledWith(
        DOCUMENT_ID,
        expect.objectContaining({ status: DocumentStatus.Ready }),
      );
    });

    it('propagates extraction errors without marking the document ready', async () => {
      const failure = new UnreadableDocumentError('corrupt');
      extractor.extract.mockRejectedValue(failure);

      await expect(service.process(DOCUMENT_ID)).rejects.toBe(failure);

      expect(repository.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('markFailed', () => {
    it('stores the failed status with its reason', async () => {
      await service.markFailed(DOCUMENT_ID, 'The PDF file is corrupt.');

      expect(repository.update).toHaveBeenCalledWith(DOCUMENT_ID, {
        status: DocumentStatus.Failed,
        failureReason: 'The PDF file is corrupt.',
      });
    });
  });
});

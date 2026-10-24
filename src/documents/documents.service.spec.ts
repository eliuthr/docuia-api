import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageProvider } from '../storage/storage.provider.js';
import { DocumentStatus } from './domain/document-status.enum.js';
import { DocumentEntity, NewDocument } from './domain/document.entity.js';
import { DocumentsService } from './documents.service.js';
import { DocumentRepository } from './repositories/document.repository.js';
import { UploadedDocumentFile } from './domain/uploaded-document-file.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const pdfFile: UploadedDocumentFile = {
  originalname: 'invoice-001.pdf',
  mimetype: 'application/pdf',
  size: 7,
  buffer: Buffer.from('%PDF-1.'),
};

function toEntity(document: NewDocument): DocumentEntity {
  const now = new Date('2026-10-22T18:00:00.000Z');
  return { ...document, createdAt: now, updatedAt: now };
}

describe('DocumentsService', () => {
  let storage: {
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findRecent: ReturnType<typeof vi.fn>;
  };
  let service: DocumentsService;

  beforeEach(() => {
    storage = {
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    repository = {
      create: vi.fn((document: NewDocument) =>
        Promise.resolve(toEntity(document)),
      ),
      findById: vi.fn(),
      findRecent: vi.fn(),
    };
    service = new DocumentsService(
      storage as unknown as StorageProvider,
      repository as unknown as DocumentRepository,
    );
  });

  describe('upload', () => {
    it('stores the file and persists a pending document', async () => {
      const document = await service.upload(pdfFile);

      expect(document.id).toMatch(UUID_PATTERN);
      expect(document).toMatchObject({
        originalName: 'invoice-001.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 7,
        storageKey: `${document.id}.pdf`,
        status: DocumentStatus.Pending,
      });
      expect(storage.save).toHaveBeenCalledWith(
        `${document.id}.pdf`,
        pdfFile.buffer,
      );
    });

    it('derives the extension from the MIME type, not the filename', async () => {
      const document = await service.upload({
        ...pdfFile,
        originalname: 'photo.exe',
        mimetype: 'image/jpeg',
      });

      expect(document.storageKey).toBe(`${document.id}.jpg`);
    });

    it('deletes the stored file when persisting fails', async () => {
      const failure = new Error('database down');
      repository.create.mockRejectedValue(failure);

      await expect(service.upload(pdfFile)).rejects.toBe(failure);

      const [storedKey] = storage.save.mock.calls[0] as [string];
      expect(storage.delete).toHaveBeenCalledWith(storedKey);
    });

    it('rejects an unsupported MIME type without storing anything', async () => {
      await expect(
        service.upload({ ...pdfFile, mimetype: 'text/plain' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storage.save).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the document when it exists', async () => {
      const existing = toEntity({
        id: 'a',
        originalName: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        storageKey: 'a.pdf',
        status: DocumentStatus.Pending,
      });
      repository.findById.mockResolvedValue(existing);

      await expect(service.findById('a')).resolves.toBe(existing);
    });

    it('throws NotFoundException when the document does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findRecent', () => {
    it('delegates the limit to the repository', async () => {
      repository.findRecent.mockResolvedValue([]);

      await service.findRecent(5);

      expect(repository.findRecent).toHaveBeenCalledWith(5);
    });
  });
});

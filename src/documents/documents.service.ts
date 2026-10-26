import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QueueProvider } from '../processing/queue/queue.provider.js';
import { StorageProvider } from '../storage/storage.provider.js';
import { DocumentPageCursor } from './domain/document-page.js';
import { DocumentStatus } from './domain/document-status.enum.js';
import { DocumentEntity, NewDocument } from './domain/document.entity.js';
import { UploadedDocumentFile } from './domain/uploaded-document-file.js';
import { FILE_EXTENSION_BY_MIME_TYPE } from './documents.constants.js';
import { documentCursorCodec } from './pagination/document-cursor.codec.js';
import { DocumentRepository } from './repositories/document.repository.js';

export interface ListedDocuments {
  documents: DocumentEntity[];
  nextCursor: string | null;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly storage: StorageProvider,
    private readonly repository: DocumentRepository,
    private readonly queue: QueueProvider,
  ) {}

  async upload(file: UploadedDocumentFile): Promise<DocumentEntity> {
    const newDocument = buildNewDocument(file);

    await this.storage.save(newDocument.storageKey, file.buffer);
    const document = await this.createOrDiscardFile(newDocument);
    await this.enqueueOrDiscardDocument(document);
    this.logger.log({ event: 'document.uploaded', documentId: document.id });
    return document;
  }

  async findById(id: string): Promise<DocumentEntity> {
    const document = await this.repository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return document;
  }

  /** Una página de la lista; `cursor` es el `nextCursor` opaco de la página anterior. */
  async findPage(limit: number, cursor?: string): Promise<ListedDocuments> {
    const after = cursor ? decodeCursorOrThrow(cursor) : null;
    const page = await this.repository.findPage({ limit, after });
    return {
      documents: page.documents,
      nextCursor: page.nextCursor
        ? documentCursorCodec.encode(page.nextCursor)
        : null,
    };
  }

  private async createOrDiscardFile(
    newDocument: NewDocument,
  ): Promise<DocumentEntity> {
    try {
      return await this.repository.create(newDocument);
    } catch (error) {
      await this.storage.delete(newDocument.storageKey);
      throw error;
    }
  }

  private async enqueueOrDiscardDocument(
    document: DocumentEntity,
  ): Promise<void> {
    try {
      await this.queue.enqueue({ documentId: document.id });
    } catch (error) {
      this.logger.error(
        { event: 'document.enqueue_failed', documentId: document.id },
        error instanceof Error ? error.stack : String(error),
      );
      await this.repository.delete(document.id);
      await this.storage.delete(document.storageKey);
      throw new ServiceUnavailableException(
        'Document processing is temporarily unavailable. Try again later.',
      );
    }
  }
}

function decodeCursorOrThrow(cursor: string): DocumentPageCursor {
  const decoded = documentCursorCodec.decode(cursor);
  if (!decoded) {
    throw new BadRequestException('Invalid cursor');
  }
  return decoded;
}

function buildNewDocument(file: UploadedDocumentFile): NewDocument {
  const id = randomUUID();
  return {
    id,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageKey: buildStorageKey(id, file.mimetype),
    status: DocumentStatus.Pending,
    textStorageKey: null,
    pageCount: null,
    failureReason: null,
    documentType: null,
    summary: null,
    extractedData: null,
  };
}

function buildStorageKey(id: string, mimeType: string): string {
  const extension = FILE_EXTENSION_BY_MIME_TYPE[mimeType];
  if (!extension) {
    throw new BadRequestException(`Unsupported file type: ${mimeType}`);
  }
  return `${id}${extension}`;
}

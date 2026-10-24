import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StorageProvider } from '../storage/storage.provider.js';
import { DocumentStatus } from './domain/document-status.enum.js';
import { DocumentEntity, NewDocument } from './domain/document.entity.js';
import { FILE_EXTENSION_BY_MIME_TYPE } from './documents.constants.js';
import { DocumentRepository } from './repositories/document.repository.js';
import { UploadedDocumentFile } from './domain/uploaded-document-file.js';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly storage: StorageProvider,
    private readonly repository: DocumentRepository,
  ) {}

  async upload(file: UploadedDocumentFile): Promise<DocumentEntity> {
    const id = randomUUID();
    const newDocument: NewDocument = {
      id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey: buildStorageKey(id, file.mimetype),
      status: DocumentStatus.Pending,
    };

    await this.storage.save(newDocument.storageKey, file.buffer);
    const document = await this.createOrDiscardFile(newDocument);
    this.logger.log({ event: 'document.uploaded', documentId: id });
    return document;
  }

  async findById(id: string): Promise<DocumentEntity> {
    const document = await this.repository.findById(id);
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return document;
  }

  findRecent(limit: number): Promise<DocumentEntity[]> {
    return this.repository.findRecent(limit);
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
}

function buildStorageKey(id: string, mimeType: string): string {
  const extension = FILE_EXTENSION_BY_MIME_TYPE[mimeType];
  if (!extension) {
    throw new BadRequestException(`Unsupported file type: ${mimeType}`);
  }
  return `${id}${extension}`;
}

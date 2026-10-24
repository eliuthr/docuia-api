import { Injectable, Logger } from '@nestjs/common';
import { DocumentStatus } from '../documents/domain/document-status.enum.js';
import {
  DocumentChanges,
  DocumentEntity,
} from '../documents/domain/document.entity.js';
import { DocumentRepository } from '../documents/repositories/document.repository.js';
import { StorageProvider } from '../storage/storage.provider.js';
import { TextExtractorRegistry } from './extraction/text-extractor.registry.js';

const TEXT_FILE_EXTENSION = '.txt';
const FINISHED_STATUSES: ReadonlySet<DocumentStatus> = new Set([
  DocumentStatus.Ready,
  DocumentStatus.Failed,
]);

type ExtractionResult = Pick<DocumentChanges, 'textStorageKey' | 'pageCount'>;

/**
 * Convierte un documento subido en uno procesado. No sabe nada de la tecnología
 * de colas, así que cualquier consumidor (BullMQ, una Lambda con SQS) puede llamarlo.
 */
@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private readonly repository: DocumentRepository,
    private readonly storage: StorageProvider,
    private readonly extractors: TextExtractorRegistry,
  ) {}

  async process(documentId: string): Promise<void> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      this.logger.warn({ event: 'document.processing.missing', documentId });
      return;
    }
    if (FINISHED_STATUSES.has(document.status)) {
      this.logger.log({ event: 'document.processing.skipped', documentId });
      return;
    }

    await this.repository.update(documentId, {
      status: DocumentStatus.Processing,
    });
    const extraction = await this.extract(document);
    await this.repository.update(documentId, {
      ...extraction,
      status: DocumentStatus.Ready,
      failureReason: null,
    });
    this.logger.log({ event: 'document.processing.ready', documentId });
  }

  async markFailed(documentId: string, reason: string): Promise<void> {
    await this.repository.update(documentId, {
      status: DocumentStatus.Failed,
      failureReason: reason,
    });
    this.logger.warn({ event: 'document.processing.failed', documentId });
  }

  private async extract(document: DocumentEntity): Promise<ExtractionResult> {
    const extractor = this.extractors.forMimeType(document.mimeType);
    if (!extractor) {
      return { textStorageKey: null, pageCount: null };
    }

    const content = await this.storage.read(document.storageKey);
    const { text, pageCount } = await extractor.extract(content);
    const textStorageKey = `${document.id}${TEXT_FILE_EXTENSION}`;
    await this.storage.save(textStorageKey, Buffer.from(text, 'utf8'));
    return { textStorageKey, pageCount };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InvalidLlmResponseError } from '../ai/errors/invalid-llm-response.error.js';
import { LlmQuotaExceededError } from '../ai/errors/llm-quota-exceeded.error.js';
import { DocumentAnalyzerService } from '../ai/extraction/document-analyzer.service.js';
import { LlmInput } from '../ai/llm/llm.provider.js';
import { DocumentStatus } from '../documents/domain/document-status.enum.js';
import {
  DocumentChanges,
  DocumentEntity,
} from '../documents/domain/document.entity.js';
import { DocumentRepository } from '../documents/repositories/document.repository.js';
import { StorageProvider } from '../storage/storage.provider.js';
import { DataExtractionFailedError } from './errors/data-extraction-failed.error.js';
import { TextExtractorRegistry } from './extraction/text-extractor.registry.js';

const TEXT_FILE_EXTENSION = '.txt';
const FINISHED_STATUSES: ReadonlySet<DocumentStatus> = new Set([
  DocumentStatus.Ready,
  DocumentStatus.Failed,
]);
const NO_ANALYSIS: NullableAnalysis = {
  documentType: null,
  extractedData: null,
};

type NullableAnalysis = Pick<DocumentChanges, 'documentType' | 'extractedData'>;

interface ExtractedContent {
  changes: Pick<DocumentChanges, 'textStorageKey' | 'pageCount'>;
  /** Lo que se le envía al LLM; null si no hay nada que analizar (PDF sin texto). */
  llmInput: LlmInput | null;
}

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
    private readonly analyzer: DocumentAnalyzerService,
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
    const { changes, llmInput } = await this.extractContent(document);
    const analysis = await this.analyze(documentId, llmInput);
    await this.repository.update(documentId, {
      ...changes,
      ...analysis,
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

  /** Los PDFs se convierten a texto; las imágenes van tal cual al modelo con visión. */
  private async extractContent(
    document: DocumentEntity,
  ): Promise<ExtractedContent> {
    const content = await this.storage.read(document.storageKey);
    const extractor = this.extractors.forMimeType(document.mimeType);
    if (!extractor) {
      return {
        changes: { textStorageKey: null, pageCount: null },
        llmInput: { kind: 'image', mimeType: document.mimeType, content },
      };
    }

    const { text, pageCount } = await extractor.extract(content);
    const textStorageKey = `${document.id}${TEXT_FILE_EXTENSION}`;
    await this.storage.save(textStorageKey, Buffer.from(text, 'utf8'));
    return {
      changes: { textStorageKey, pageCount },
      llmInput: text.trim() ? { kind: 'text', text } : null,
    };
  }

  private async analyze(
    documentId: string,
    llmInput: LlmInput | null,
  ): Promise<NullableAnalysis> {
    if (!llmInput) {
      return NO_ANALYSIS;
    }
    try {
      return await this.analyzer.analyze(documentId, llmInput);
    } catch (error) {
      if (!isPermanentLlmError(error)) {
        throw error;
      }
      // El mensaje que ven los clientes es genérico; aquí queda la causa real.
      this.logger.warn({
        event: 'document.analysis.failed',
        documentId,
        error: error.message,
      });
      throw new DataExtractionFailedError(error);
    }
  }
}

/** Fallas del LLM que no se arreglan reintentando. */
function isPermanentLlmError(
  error: unknown,
): error is InvalidLlmResponseError | LlmQuotaExceededError {
  return (
    error instanceof InvalidLlmResponseError ||
    error instanceof LlmQuotaExceededError
  );
}

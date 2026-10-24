import { Injectable, Logger } from '@nestjs/common';
import { LlmInput } from '../llm/llm.provider.js';
import { DocumentType } from '../schemas/document-type.js';
import { ExtractedData } from '../schemas/extracted-data.js';
import { DocumentClassifierService } from './document-classifier.service.js';
import { DocumentDataExtractorService } from './document-data-extractor.service.js';

export interface DocumentAnalysis {
  documentType: DocumentType;
  extractedData: ExtractedData | null;
}

/** Clasifica un documento y, si es de un tipo conocido, extrae sus datos. */
@Injectable()
export class DocumentAnalyzerService {
  private readonly logger = new Logger(DocumentAnalyzerService.name);

  constructor(
    private readonly classifier: DocumentClassifierService,
    private readonly extractor: DocumentDataExtractorService,
  ) {}

  async analyze(
    documentId: string,
    input: LlmInput,
  ): Promise<DocumentAnalysis> {
    const documentType = await this.classifier.classify(documentId, input);
    this.logger.log({ event: 'document.classified', documentId, documentType });
    if (documentType === DocumentType.Other) {
      return { documentType, extractedData: null };
    }

    const extractedData = await this.extractor.extract(
      documentId,
      documentType,
      input,
    );
    return { documentType, extractedData };
  }
}

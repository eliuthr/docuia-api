import { Injectable, Logger } from '@nestjs/common';
import { LlmInput } from '../llm/llm.provider.js';
import { DocumentType } from '../schemas/document-type.js';
import { ExtractedData } from '../schemas/extracted-data.js';
import { DocumentDataExtractorService } from './document-data-extractor.service.js';
import { DocumentOverviewService } from './document-overview.service.js';

export interface DocumentAnalysis {
  documentType: DocumentType;
  summary: string;
  extractedData: ExtractedData | null;
}

/** Clasifica y resume un documento y, si es de un tipo conocido, extrae sus datos. */
@Injectable()
export class DocumentAnalyzerService {
  private readonly logger = new Logger(DocumentAnalyzerService.name);

  constructor(
    private readonly overview: DocumentOverviewService,
    private readonly extractor: DocumentDataExtractorService,
  ) {}

  async analyze(
    documentId: string,
    input: LlmInput,
  ): Promise<DocumentAnalysis> {
    const { documentType, summary } = await this.overview.describe(
      documentId,
      input,
    );
    this.logger.log({ event: 'document.classified', documentId, documentType });
    if (documentType === DocumentType.Other) {
      return { documentType, summary, extractedData: null };
    }

    const extractedData = await this.extractor.extract(
      documentId,
      documentType,
      input,
    );
    return { documentType, summary, extractedData };
  }
}

import { Module } from '@nestjs/common';
import { DocumentAnalyzerService } from './extraction/document-analyzer.service.js';
import { DocumentClassifierService } from './extraction/document-classifier.service.js';
import { DocumentDataExtractorService } from './extraction/document-data-extractor.service.js';
import { StructuredOutputService } from './extraction/structured-output.service.js';
import { LlmModule } from './llm/llm.module.js';

/** Todo lo relacionado con el LLM. Solo expone el análisis de documentos. */
@Module({
  imports: [LlmModule],
  providers: [
    StructuredOutputService,
    DocumentClassifierService,
    DocumentDataExtractorService,
    DocumentAnalyzerService,
  ],
  exports: [DocumentAnalyzerService],
})
export class AiModule {}

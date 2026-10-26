import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { DocumentEventsPublisherModule } from '../documents/events/document-events-publisher.module.js';
import { DocumentPersistenceModule } from '../documents/repositories/document-persistence.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { DocumentJobRunner } from './document-job.runner.js';
import { DocumentProcessingService } from './document-processing.service.js';
import { PdfTextExtractor } from './extraction/pdf-text-extractor.js';
import { TextExtractorRegistry } from './extraction/text-extractor.registry.js';

/**
 * El procesamiento de documentos sin ningún consumidor de cola: lo usan el
 * worker local (BullMQ) y el de Lambda (SQS).
 */
@Module({
  imports: [
    StorageModule,
    DocumentPersistenceModule,
    DocumentEventsPublisherModule,
    AiModule,
  ],
  providers: [
    DocumentProcessingService,
    DocumentJobRunner,
    TextExtractorRegistry,
    PdfTextExtractor,
  ],
  exports: [DocumentJobRunner],
})
export class ProcessingCoreModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { DocumentEventsPublisherModule } from '../documents/events/document-events-publisher.module.js';
import { DocumentPersistenceModule } from '../documents/repositories/document-persistence.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { BullmqDocumentConsumer } from './bullmq-document.consumer.js';
import { DocumentProcessingService } from './document-processing.service.js';
import { PdfTextExtractor } from './extraction/pdf-text-extractor.js';
import { TextExtractorRegistry } from './extraction/text-extractor.registry.js';
import { BullmqConnectionModule } from './queue/bullmq-connection.module.js';
import { DOCUMENT_PROCESSING_QUEUE } from './queue/document-job.js';

/** Lado consumidor de la cola de procesamiento; solo lo carga el worker. */
@Module({
  imports: [
    BullmqConnectionModule,
    BullModule.registerQueue({ name: DOCUMENT_PROCESSING_QUEUE }),
    StorageModule,
    DocumentPersistenceModule,
    DocumentEventsPublisherModule,
    AiModule,
  ],
  providers: [
    DocumentProcessingService,
    TextExtractorRegistry,
    PdfTextExtractor,
    BullmqDocumentConsumer,
  ],
})
export class ProcessingModule {}

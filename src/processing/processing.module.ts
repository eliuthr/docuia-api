import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BullmqDocumentConsumer } from './bullmq-document.consumer.js';
import { ProcessingCoreModule } from './processing-core.module.js';
import { BullmqConnectionModule } from './queue/bullmq-connection.module.js';
import { DOCUMENT_PROCESSING_QUEUE } from './queue/document-job.js';

/** Lado consumidor de la cola con BullMQ; solo lo carga el worker local. */
@Module({
  imports: [
    BullmqConnectionModule,
    BullModule.registerQueue({ name: DOCUMENT_PROCESSING_QUEUE }),
    ProcessingCoreModule,
  ],
  providers: [BullmqDocumentConsumer],
})
export class ProcessingModule {}

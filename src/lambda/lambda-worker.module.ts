import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProcessingCoreModule } from '../processing/processing-core.module.js';
import { SqsDocumentConsumer } from '../processing/sqs-document.consumer.js';

/** Módulo raíz del worker en Lambda: el procesamiento y el consumidor de SQS, sin HTTP. */
@Module({
  imports: [AppConfigModule, DatabaseModule, ProcessingCoreModule],
  providers: [SqsDocumentConsumer],
})
export class LambdaWorkerModule {}

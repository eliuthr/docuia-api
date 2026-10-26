import { Module } from '@nestjs/common';
import { importForDriver } from '../../common/modules/import-for-driver.js';
import { DynamoDbDocumentPersistenceModule } from './dynamodb-document-persistence.module.js';
import { MongoDocumentPersistenceModule } from './mongo-document-persistence.module.js';

/** Da acceso a `DocumentRepository` con la implementación de DATABASE_DRIVER. */
@Module({
  imports: [
    ...importForDriver('DATABASE_DRIVER', {
      mongodb: MongoDocumentPersistenceModule,
      dynamodb: DynamoDbDocumentPersistenceModule,
    }),
  ],
})
export class DocumentPersistenceModule {}

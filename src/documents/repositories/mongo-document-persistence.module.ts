import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DocumentRecord,
  DocumentRecordSchema,
} from '../schemas/document-record.schema.js';
import { DocumentRepository } from './document.repository.js';
import { MongoDocumentRepository } from './mongo-document.repository.js';

/** Global: lo importa DocumentPersistenceModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentRecord.name, schema: DocumentRecordSchema },
    ]),
  ],
  providers: [
    { provide: DocumentRepository, useClass: MongoDocumentRepository },
  ],
  exports: [DocumentRepository],
})
export class MongoDocumentPersistenceModule {}

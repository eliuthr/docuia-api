import { Global, Module } from '@nestjs/common';
import { dynamoDbDocumentClientProvider } from '../../common/aws/aws-clients.js';
import { DocumentRepository } from './document.repository.js';
import { DynamoDbDocumentRepository } from './dynamodb-document.repository.js';

/** Global: lo importa DocumentPersistenceModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  providers: [
    dynamoDbDocumentClientProvider,
    { provide: DocumentRepository, useClass: DynamoDbDocumentRepository },
  ],
  exports: [DocumentRepository],
})
export class DynamoDbDocumentPersistenceModule {}

import { Global, Module } from '@nestjs/common';
import { dynamoDbDocumentClientProvider } from '../../common/aws/aws-clients.js';
import { ConversationRepository } from './conversation.repository.js';
import { DynamoDbConversationRepository } from './dynamodb-conversation.repository.js';

/** Global: lo importa ConversationPersistenceModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  providers: [
    dynamoDbDocumentClientProvider,
    {
      provide: ConversationRepository,
      useClass: DynamoDbConversationRepository,
    },
  ],
  exports: [ConversationRepository],
})
export class DynamoDbConversationPersistenceModule {}

import { Module } from '@nestjs/common';
import { importForDriver } from '../../common/modules/import-for-driver.js';
import { DynamoDbConversationPersistenceModule } from './dynamodb-conversation-persistence.module.js';
import { MongoConversationPersistenceModule } from './mongo-conversation-persistence.module.js';

/** Da acceso a `ConversationRepository` con la implementación de DATABASE_DRIVER. */
@Module({
  imports: [
    ...importForDriver('DATABASE_DRIVER', {
      mongodb: MongoConversationPersistenceModule,
      dynamodb: DynamoDbConversationPersistenceModule,
    }),
  ],
})
export class ConversationPersistenceModule {}

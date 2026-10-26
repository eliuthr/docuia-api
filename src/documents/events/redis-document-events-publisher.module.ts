import { Global, Module } from '@nestjs/common';
import { DocumentEventsPublisher } from './document-events.publisher.js';
import { eventsRedisClientProvider } from './events-redis-client.provider.js';
import { RedisDocumentEventsPublisher } from './redis-document-events.publisher.js';

/** Global: lo importa DocumentEventsPublisherModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  providers: [
    eventsRedisClientProvider,
    {
      provide: DocumentEventsPublisher,
      useClass: RedisDocumentEventsPublisher,
    },
  ],
  exports: [DocumentEventsPublisher],
})
export class RedisDocumentEventsPublisherModule {}

import { Global, Module } from '@nestjs/common';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';
import { eventsRedisClientProvider } from './events-redis-client.provider.js';
import { RedisDocumentEventsSubscriber } from './redis-document-events.subscriber.js';

/** Global: lo importa DocumentEventsSubscriberModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  providers: [
    eventsRedisClientProvider,
    {
      provide: DocumentEventsSubscriber,
      useClass: RedisDocumentEventsSubscriber,
    },
  ],
  exports: [DocumentEventsSubscriber],
})
export class RedisDocumentEventsSubscriberModule {}

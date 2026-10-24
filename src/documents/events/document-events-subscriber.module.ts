import { Module } from '@nestjs/common';
import { provideByDriver } from '../../common/providers/provide-by-driver.js';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';
import { eventsRedisClientProvider } from './events-redis-client.provider.js';
import { RedisDocumentEventsSubscriber } from './redis-document-events.subscriber.js';

/** Lado que escucha los eventos; lo usa la API. */
@Module({
  providers: [
    eventsRedisClientProvider,
    provideByDriver(DocumentEventsSubscriber, 'EVENTS_DRIVER', {
      redis: RedisDocumentEventsSubscriber,
    }),
  ],
  exports: [DocumentEventsSubscriber],
})
export class DocumentEventsSubscriberModule {}

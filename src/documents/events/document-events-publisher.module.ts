import { Module } from '@nestjs/common';
import { provideByDriver } from '../../common/providers/provide-by-driver.js';
import { DocumentEventsPublisher } from './document-events.publisher.js';
import { eventsRedisClientProvider } from './events-redis-client.provider.js';
import { RedisDocumentEventsPublisher } from './redis-document-events.publisher.js';

/** Lado que publica los eventos; lo usa el worker. */
@Module({
  providers: [
    eventsRedisClientProvider,
    provideByDriver(DocumentEventsPublisher, 'EVENTS_DRIVER', {
      redis: RedisDocumentEventsPublisher,
    }),
  ],
  exports: [DocumentEventsPublisher],
})
export class DocumentEventsPublisherModule {}

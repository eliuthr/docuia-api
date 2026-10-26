import { Module } from '@nestjs/common';
import { importForDriver } from '../../common/modules/import-for-driver.js';
import { NoneDocumentEventsSubscriberModule } from './none-document-events-subscriber.module.js';
import { RedisDocumentEventsSubscriberModule } from './redis-document-events-subscriber.module.js';

/** Lado que escucha los eventos; lo usa la API. */
@Module({
  imports: [
    ...importForDriver('EVENTS_DRIVER', {
      redis: RedisDocumentEventsSubscriberModule,
      none: NoneDocumentEventsSubscriberModule,
    }),
  ],
})
export class DocumentEventsSubscriberModule {}

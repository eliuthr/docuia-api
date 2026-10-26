import { Module } from '@nestjs/common';
import { importForDriver } from '../../common/modules/import-for-driver.js';
import { NoneDocumentEventsPublisherModule } from './none-document-events-publisher.module.js';
import { RedisDocumentEventsPublisherModule } from './redis-document-events-publisher.module.js';

/** Lado que publica los eventos; lo usa el worker. */
@Module({
  imports: [
    ...importForDriver('EVENTS_DRIVER', {
      redis: RedisDocumentEventsPublisherModule,
      none: NoneDocumentEventsPublisherModule,
    }),
  ],
})
export class DocumentEventsPublisherModule {}

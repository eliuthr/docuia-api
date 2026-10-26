import { Global, Module } from '@nestjs/common';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';
import { UnavailableDocumentEventsSubscriber } from './unavailable-document-events.subscriber.js';

/** Global: lo importa DocumentEventsSubscriberModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  providers: [
    {
      provide: DocumentEventsSubscriber,
      useClass: UnavailableDocumentEventsSubscriber,
    },
  ],
  exports: [DocumentEventsSubscriber],
})
export class NoneDocumentEventsSubscriberModule {}

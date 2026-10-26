import { Global, Module } from '@nestjs/common';
import { DocumentEventsPublisher } from './document-events.publisher.js';
import { NoopDocumentEventsPublisher } from './noop-document-events.publisher.js';

/** Global: lo importa DocumentEventsPublisherModule de forma condicional (ver importForDriver). */
@Global()
@Module({
  providers: [
    { provide: DocumentEventsPublisher, useClass: NoopDocumentEventsPublisher },
  ],
  exports: [DocumentEventsPublisher],
})
export class NoneDocumentEventsPublisherModule {}

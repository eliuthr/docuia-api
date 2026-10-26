import { Injectable } from '@nestjs/common';
import { DocumentEventsPublisher } from './document-events.publisher.js';

/**
 * Publicador del driver `none` (AWS): no hay a quién avisar, porque el cliente
 * web consulta el estado con polling. La base de datos sigue siendo la fuente de verdad.
 */
@Injectable()
export class NoopDocumentEventsPublisher extends DocumentEventsPublisher {
  publish(): Promise<void> {
    return Promise.resolve();
  }
}

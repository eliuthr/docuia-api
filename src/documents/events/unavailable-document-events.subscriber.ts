import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';
import { DocumentStatusEvent } from './document-status-event.js';

/** Los eventos en vivo no están disponibles en este despliegue. */
export class LiveEventsUnavailableError extends Error {
  override readonly name = 'LiveEventsUnavailableError';

  constructor() {
    super('Live status events are not available in this deployment.');
  }
}

/**
 * Suscriptor del driver `none` (AWS). Falla al pedir el flujo, antes de que
 * empiece la respuesta SSE, para que la API pueda responder 503.
 */
@Injectable()
export class UnavailableDocumentEventsSubscriber extends DocumentEventsSubscriber {
  events(): Observable<DocumentStatusEvent> {
    throw new LiveEventsUnavailableError();
  }
}

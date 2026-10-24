import { Observable } from 'rxjs';
import { DocumentStatusEvent } from './document-status-event.js';

/** Recibe los cambios de estado que publica el worker. */
export abstract class DocumentEventsSubscriber {
  /** Un solo flujo por proceso, compartido por todos los clientes conectados. */
  abstract events(): Observable<DocumentStatusEvent>;
}

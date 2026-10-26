import {
  Injectable,
  MessageEvent,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { interval, map, merge, Observable } from 'rxjs';
import { Env } from '../../config/env.schema.js';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';
import { DocumentStatusEvent } from './document-status-event.js';
import { LiveEventsUnavailableError } from './unavailable-document-events.subscriber.js';

export const DOCUMENT_UPDATED_EVENT = 'document.updated';
export const PING_EVENT = 'ping';

/**
 * Flujo SSE para un cliente: los cambios de estado más un `ping` periódico,
 * para que un proxy no cierre la conexión por inactividad.
 */
@Injectable()
export class DocumentStatusStreamService {
  private readonly heartbeatMs: number;

  constructor(
    private readonly subscriber: DocumentEventsSubscriber,
    config: ConfigService<Env, true>,
  ) {
    this.heartbeatMs = config.get('EVENTS_HEARTBEAT_MS', { infer: true });
  }

  stream(): Observable<MessageEvent> {
    const updates = this.statusEvents().pipe(
      map((event) => ({ type: DOCUMENT_UPDATED_EVENT, data: event })),
    );
    const heartbeat = interval(this.heartbeatMs).pipe(
      map(() => ({ type: PING_EVENT, data: {} })),
    );
    return merge(updates, heartbeat);
  }

  /**
   * Se lanza aquí, antes de abrir el stream, para responder 503 en vez de 200:
   * el navegador no reconecta tras un error HTTP y el cliente web pasa a polling.
   */
  private statusEvents(): Observable<DocumentStatusEvent> {
    try {
      return this.subscriber.events();
    } catch (error) {
      if (error instanceof LiveEventsUnavailableError) {
        throw new ServiceUnavailableException(
          'Live status updates are not available. Poll GET /documents/:id instead.',
        );
      }
      throw error;
    }
  }
}

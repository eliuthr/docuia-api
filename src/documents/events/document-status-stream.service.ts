import { Injectable, MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { interval, map, merge, Observable } from 'rxjs';
import { Env } from '../../config/env.schema.js';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';

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
    const updates = this.subscriber
      .events()
      .pipe(map((event) => ({ type: DOCUMENT_UPDATED_EVENT, data: event })));
    const heartbeat = interval(this.heartbeatMs).pipe(
      map(() => ({ type: PING_EVENT, data: {} })),
    );
    return merge(updates, heartbeat);
  }
}

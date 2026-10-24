import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { parseJson } from '../../common/json/parse-json.js';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';
import {
  DOCUMENT_EVENTS_CHANNEL,
  DocumentStatusEvent,
  documentStatusEventSchema,
  EVENTS_REDIS_CLIENT,
} from './document-status-event.js';

/**
 * Una sola suscripción de Redis por proceso: cada mensaje se reparte a todos
 * los clientes conectados a través de un Subject de RxJS.
 */
@Injectable()
export class RedisDocumentEventsSubscriber
  extends DocumentEventsSubscriber
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisDocumentEventsSubscriber.name);
  private readonly statusEvents = new Subject<DocumentStatusEvent>();

  constructor(@Inject(EVENTS_REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async onModuleInit(): Promise<void> {
    this.redis.on('message', (channel: string, message: string) =>
      this.handleMessage(channel, message),
    );
    await this.redis.subscribe(DOCUMENT_EVENTS_CHANNEL);
  }

  events(): Observable<DocumentStatusEvent> {
    return this.statusEvents.asObservable();
  }

  async onModuleDestroy(): Promise<void> {
    this.statusEvents.complete();
    await this.redis.quit();
  }

  private handleMessage(channel: string, message: string): void {
    if (channel !== DOCUMENT_EVENTS_CHANNEL) {
      return;
    }
    const parsed = documentStatusEventSchema.safeParse(parseJson(message));
    if (!parsed.success) {
      this.logger.warn({ event: 'document.event.invalid', channel });
      return;
    }
    this.statusEvents.next(parsed.data);
  }
}

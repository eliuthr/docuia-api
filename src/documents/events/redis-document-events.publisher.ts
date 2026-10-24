import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { DocumentEventsPublisher } from './document-events.publisher.js';
import {
  DOCUMENT_EVENTS_CHANNEL,
  DocumentStatusEvent,
  EVENTS_REDIS_CLIENT,
} from './document-status-event.js';

@Injectable()
export class RedisDocumentEventsPublisher
  extends DocumentEventsPublisher
  implements OnModuleDestroy
{
  private readonly logger = new Logger(RedisDocumentEventsPublisher.name);

  constructor(@Inject(EVENTS_REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async publish(event: DocumentStatusEvent): Promise<void> {
    try {
      await this.redis.publish(DOCUMENT_EVENTS_CHANNEL, JSON.stringify(event));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({
        event: 'document.event.publish_failed',
        documentId: event.documentId,
        error: message,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

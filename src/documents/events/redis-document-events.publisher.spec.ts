import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { DocumentStatus } from '../domain/document-status.enum.js';
import { DOCUMENT_EVENTS_CHANNEL } from './document-status-event.js';
import { RedisDocumentEventsPublisher } from './redis-document-events.publisher.js';

const EVENT = { documentId: 'doc-1', status: DocumentStatus.Ready };

describe('RedisDocumentEventsPublisher', () => {
  let redis: {
    publish: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
  };
  let publisher: RedisDocumentEventsPublisher;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    redis = {
      publish: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue('OK'),
    };
    publisher = new RedisDocumentEventsPublisher(redis as unknown as Redis);
  });

  it('publishes the event as JSON on the documents channel', async () => {
    await publisher.publish(EVENT);

    expect(redis.publish).toHaveBeenCalledWith(
      DOCUMENT_EVENTS_CHANNEL,
      '{"documentId":"doc-1","status":"ready"}',
    );
  });

  it('logs and swallows a publishing failure', async () => {
    redis.publish.mockRejectedValue(new Error('Connection is closed.'));

    await expect(publisher.publish(EVENT)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('closes the connection on shutdown', async () => {
    await publisher.onModuleDestroy();

    expect(redis.quit).toHaveBeenCalled();
  });
});

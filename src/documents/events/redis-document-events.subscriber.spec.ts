import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EventEmitter } from 'node:events';
import { firstValueFrom, take, toArray } from 'rxjs';
import { DocumentStatus } from '../domain/document-status.enum.js';
import { DocumentEventsSubscriberModule } from './document-events-subscriber.module.js';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';
import {
  DOCUMENT_EVENTS_CHANNEL,
  EVENTS_REDIS_CLIENT,
} from './document-status-event.js';

/** Cliente de Redis falso: `emit('message', ...)` simula un mensaje publicado. */
class FakeRedis extends EventEmitter {
  subscribe = vi.fn().mockResolvedValue(1);
  quit = vi.fn().mockResolvedValue('OK');
}

describe('RedisDocumentEventsSubscriber', () => {
  let redis: FakeRedis;
  let subscriber: DocumentEventsSubscriber;
  let warn: ReturnType<typeof vi.spyOn>;
  let close: () => Promise<void>;

  beforeEach(async () => {
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    redis = new FakeRedis();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ EVENTS_DRIVER: 'redis' })],
        }),
        DocumentEventsSubscriberModule,
      ],
    })
      .overrideProvider(EVENTS_REDIS_CLIENT)
      .useValue(redis)
      .compile();
    await moduleRef.init();
    subscriber = moduleRef.get(DocumentEventsSubscriber);
    close = () => moduleRef.close();
  });

  it('subscribes to the documents channel when the module starts', () => {
    expect(redis.subscribe).toHaveBeenCalledWith(DOCUMENT_EVENTS_CHANNEL);
  });

  it('emits valid status events and ignores invalid messages', async () => {
    const received = firstValueFrom(
      subscriber.events().pipe(take(2), toArray()),
    );

    redis.emit(
      'message',
      DOCUMENT_EVENTS_CHANNEL,
      '{"documentId":"a","status":"processing"}',
    );
    redis.emit('message', DOCUMENT_EVENTS_CHANNEL, 'not json');
    redis.emit(
      'message',
      DOCUMENT_EVENTS_CHANNEL,
      '{"documentId":"a","status":"deleted"}',
    );
    redis.emit(
      'message',
      'other-channel',
      '{"documentId":"b","status":"ready"}',
    );
    redis.emit(
      'message',
      DOCUMENT_EVENTS_CHANNEL,
      '{"documentId":"a","status":"ready"}',
    );

    await expect(received).resolves.toEqual([
      { documentId: 'a', status: DocumentStatus.Processing },
      { documentId: 'a', status: DocumentStatus.Ready },
    ]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('closes the connection on shutdown', async () => {
    await close();

    expect(redis.quit).toHaveBeenCalled();
  });
});

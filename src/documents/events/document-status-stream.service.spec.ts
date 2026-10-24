import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import { Env } from '../../config/env.schema.js';
import { DocumentStatus } from '../domain/document-status.enum.js';
import { DocumentEventsSubscriber } from './document-events.subscriber.js';
import { DocumentStatusEvent } from './document-status-event.js';
import { DocumentStatusStreamService } from './document-status-stream.service.js';

const HEARTBEAT_MS = 1000;

describe('DocumentStatusStreamService', () => {
  let events: Subject<DocumentStatusEvent>;
  let service: DocumentStatusStreamService;

  beforeEach(() => {
    vi.useFakeTimers();
    events = new Subject();
    const config = {
      get: vi.fn().mockReturnValue(HEARTBEAT_MS),
    } as unknown as ConfigService<Env, true>;
    service = new DocumentStatusStreamService(
      { events: () => events.asObservable() } as DocumentEventsSubscriber,
      config,
    );
  });

  afterEach(() => vi.useRealTimers());

  it('sends status changes as document.updated events', () => {
    const received: unknown[] = [];
    const subscription = service
      .stream()
      .subscribe((event) => received.push(event));

    events.next({ documentId: 'doc-1', status: DocumentStatus.Ready });

    expect(received).toEqual([
      {
        type: 'document.updated',
        data: { documentId: 'doc-1', status: DocumentStatus.Ready },
      },
    ]);
    subscription.unsubscribe();
  });

  it('sends a ping on every heartbeat interval', () => {
    const received: unknown[] = [];
    const subscription = service
      .stream()
      .subscribe((event) => received.push(event));

    vi.advanceTimersByTime(HEARTBEAT_MS * 2);

    expect(received).toEqual([
      { type: 'ping', data: {} },
      { type: 'ping', data: {} },
    ]);
    subscription.unsubscribe();
  });

  it('stops the heartbeat when the client unsubscribes', () => {
    const received: unknown[] = [];
    service
      .stream()
      .subscribe((event) => received.push(event))
      .unsubscribe();

    vi.advanceTimersByTime(HEARTBEAT_MS * 3);

    expect(received).toEqual([]);
  });
});

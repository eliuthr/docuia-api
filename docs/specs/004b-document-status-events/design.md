# 004b — Document status events: design

## Flow

```
Worker                                   Redis                      API                     Browser
DocumentProcessingService                                           DocumentsController
  update status in DB
  publisher.publish({ id, status }) ──► PUBLISH document-events ──► subscriber (1 per process)
                                                                     Subject → Observable
                                                                     GET /documents/events ──► EventSource
                                                                     (@Sse, + ping heartbeat)   reloads list/detail
```

**Pub/sub**: publishers send messages to a named channel and every subscriber listening at that
moment receives them. Nothing is stored, so a client that was disconnected must reload the data
when it reconnects (the web client does this).

## Module map

```
src/documents/events/
├── document-status-event.ts             { documentId, status } + Zod schema + channel name
├── document-events.publisher.ts         abstract publish(event)
├── document-events.subscriber.ts        abstract events(): Observable<DocumentStatusEvent>
├── redis-document-events.publisher.ts   ioredis PUBLISH; errors logged, never thrown
├── redis-document-events.subscriber.ts  ioredis SUBSCRIBE on init → Subject; validates messages
├── document-events-publisher.module.ts  worker (imported by ProcessingModule)
└── document-events-subscriber.module.ts API (imported by DocumentsModule)
```

Redis connections: a client in subscribe mode cannot run other commands, so the subscriber uses its
own connection. Both reuse `redisConnection(config)` from the queue module.

## API endpoint

`@Sse('events')` in `DocumentsController`, declared before `@Get(':id')` so Express does not match
`events` as an id. Nest's `@Sse` sets the SSE headers and unsubscribes when the client leaves.

```ts
statusEvents(): Observable<MessageEvent> =
  merge(subscriber.events() → { type: 'document.updated', data },
        interval(EVENTS_HEARTBEAT_MS) → { type: 'ping', data: {} })
```

This endpoint uses `GET`, so browsers can use `EventSource`, which reconnects automatically. The
question endpoints (spec 004) stay `POST` with `fetch`.

## Worker change

`DocumentProcessingService` stores each status change and then publishes it, through one private
method so no call site can forget the event.

## Configuration

| Variable              | Type           | Default |
| --------------------- | -------------- | ------- |
| `EVENTS_DRIVER`       | `redis`        | `redis` |
| `EVENTS_HEARTBEAT_MS` | int 1000–60000 | `25000` |

## Testing strategy

- Unit: Redis publisher (message format, error swallowed) and subscriber (valid message emitted,
  invalid ignored) with a mocked ioredis client; processing service publishes after each update;
  controller stream merges heartbeat.
- e2e: subscriber and publisher overridden with an in-memory bus; `GET /documents/events` receives
  a published event.

## Decisions

- **SSE instead of WebSockets**: the server only needs to push; `EventSource` reconnects by itself
  and no library is needed on either side.
- **Event carries only id and status**: clients reload what they show, so the event stays small
  and the REST endpoints remain the single source of document data.
- **Polling stays as a fallback** in the web client while the stream is disconnected.

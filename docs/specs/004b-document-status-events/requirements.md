# 004b — Document status events: requirements

> Follow-up to spec 004, numbered 004b so later specs keep their roadmap numbers.
> Deliverable: the web client learns that a document changed status without polling.

## Context

The web client refreshes the document list every 3 seconds while something is processing. Status
changes happen in the worker, a separate process, so the API cannot notice them by itself. This
spec makes the worker publish status changes and the API push them to clients with Server-Sent
Events.

## Scope

In scope: publishing status changes from the worker, an SSE endpoint in the API, a heartbeat.
Out of scope: events for uploads (the uploading client already refreshes), sending the whole
document in the event, AWS implementation (spec 006 decides between Lambda response streaming and
API Gateway WebSockets), authentication of the stream (spec 007).

## User stories and acceptance criteria

### US-1 — The worker publishes status changes

- **AC-1.1** WHEN the worker sets a document to `processing`, `ready` or `failed`, THE SYSTEM SHALL
  publish `{ documentId, status }` after the change is stored.
- **AC-1.2** WHEN publishing fails, THE SYSTEM SHALL log a warning and continue processing; events
  are a convenience, the database stays the source of truth.

### US-2 — Clients receive status changes

- **AC-2.1** WHEN a client opens `GET /documents/events`, THE SYSTEM SHALL keep the connection
  open and send a `document.updated` event with `{ documentId, status }` for every published
  change.
- **AC-2.2** THE SYSTEM SHALL send a `ping` event every `EVENTS_HEARTBEAT_MS` so proxies do not
  close an idle connection.
- **AC-2.3** WHEN a published message is not a valid status event, THE SYSTEM SHALL ignore it and
  log a warning.
- **AC-2.4** WHEN the client disconnects, THE SYSTEM SHALL release its subscription.

## Non-functional requirements

- **NFR-1** Publishing and subscribing sit behind `DocumentEventsPublisher` and
  `DocumentEventsSubscriber`, chosen by `EVENTS_DRIVER` (Redis pub/sub locally).
- **NFR-2** One Redis subscription per API process, shared by all connected clients.
- **NFR-3** The worker does not open a subscription and the API does not open a publisher.
- **NFR-4** Unit tests for publisher, subscriber, the processing service and the stream; e2e test
  for the endpoint with an in-memory event bus. No new dependencies (`ioredis` and `rxjs` are
  already installed).

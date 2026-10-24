# 004b — Document status events: tasks

- [x] **T1** `EVENTS_DRIVER`, `EVENTS_HEARTBEAT_MS` + validation tests; `.env.example`.
- [x] **T2** Event model, publisher/subscriber ports, Redis implementations, modules + tests.
      (AC-1.2, AC-2.3, NFR-1–3)
- [x] **T3** `DocumentProcessingService` publishes after each status change + tests. (AC-1.1)
- [x] **T4** `GET /documents/events` with heartbeat + tests; e2e with an in-memory bus. (US-2)
- [x] **T5** README; lint, tests, e2e, build; manual check with API + worker + web client.

## Verification log

- 2026-10-24 — lint clean; 178 unit tests and 26 e2e tests pass; build OK.
- Manual check with the API and the worker running against Docker Redis and MongoDB:
  - `curl -N /documents/events` while uploading a PDF received `document.updated` with
    `processing` and then `ready` for that document.
  - Web client open on the list page, document uploaded from outside the page (curl): the new row
    appeared and turned `Ready` with 2 list requests in total, one per event, instead of a request
    every 3 seconds.
- Implementation notes:
  - Nest runs `onModuleInit`/`onModuleDestroy` on instances created through `provideByDriver`
    (verified by the subscriber module test), so the subscription opens and closes with the app.
  - `redisConnection` moved to `src/common/redis/` and `parseJson` to `src/common/json/`, since
    the queue, the events and the AI module share them.
  - The answer prompt now forbids Markdown explicitly; the model had answered with `**bold**`.

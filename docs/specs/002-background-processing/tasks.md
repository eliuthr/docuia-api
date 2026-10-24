# 002 — Background processing: tasks

- [x] **T1** Dependencies; Redis container running; new env variables + validation tests.
- [x] **T2** `StorageProvider.read` + tests.
- [x] **T3** Domain: new entity fields, schema, `update`/`delete` in repositories (Mongo and
      in-memory), response DTO. (AC-4.1, AC-4.2)
- [x] **T4** `QueueModule`: `QueueProvider`, `BullmqQueueProvider`, driver selection + tests.
      (AC-1.2, NFR-1)
- [x] **T5** Upload enqueues; rollback + `503` on enqueue failure + tests. (AC-1.1, AC-1.3)
- [x] **T6** Extraction: `TextExtractor`, `PdfTextExtractor`, registry, fixture PDF + tests.
      (AC-2.2–2.4, AC-3.2)
- [x] **T7** `DocumentProcessingService` + tests. (AC-2.1–2.6, AC-3.3)
- [x] **T8** BullMQ consumer + failure handling + tests. (AC-3.1–3.3, NFR-4)
- [x] **T9** Worker entry point, `start:worker` scripts, README.
- [x] **T10** e2e updates; lint, tests, e2e, build; manual run with Redis + worker.

## Verification log

- 2026-10-23 — lint clean; 46 unit tests and 15 e2e tests pass; build OK (`dist/main.js` and
  `dist/worker.js`).
- Manual run against Docker MongoDB + Redis, API and worker as separate processes:
  - Valid 2-page PDF → `ready`, `pageCount: 2`, text stored as `<id>.txt`.
  - Corrupt PDF → `failed` on the first attempt with "The PDF file is corrupt or cannot be read."
  - PNG → `ready`, `pageCount: null`, no text file.
  - File deleted before processing (transient error) → attempts 1, 2 (+5 s), 3 (+10 s), then
    `failed` with the generic reason; the internal file path never reached the client.
  - Redis stopped → `POST /documents` answers `503` in ~20 ms and stores nothing; after Redis
    restarts, the worker reconnects and new uploads reach `ready`.
- Implementation notes:
  - `markFailed` runs inside the job on its final attempt instead of the worker `failed` event
    (see design, "BullMQ consumer").
  - The backoff delay is a job option set by the producer, so changing `PROCESSING_BACKOFF_MS`
    only affects jobs enqueued after the API restarts.
  - The driver-selection factory was extracted to `common/providers/provide-by-driver.ts` and is
    now shared by `StorageModule` and `QueueModule`.
  - `bullmq` is pinned to `6.4.0` (6.4.1 was published the same day).

## Follow-up (not in this spec)

Documents uploaded before this spec were never enqueued and stayed `pending`, which kept the web
client polling. Locally they were enqueued once by hand. The same can happen in production if a
job is lost (for example, Redis data wiped). A future task should add a recovery step: the worker,
on startup or on a schedule, re-enqueues documents that have been `pending` or `processing` for
longer than a threshold. Enqueueing is idempotent (`jobId = documentId`), so this is safe.

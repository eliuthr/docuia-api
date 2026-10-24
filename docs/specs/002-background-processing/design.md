# 002 — Background processing: design

## Processes

```
            ┌────────── API process (main.ts) ──────────┐
 client ──► │ DocumentsController → DocumentsService     │
            │        │ save file   │ create   │ enqueue  │
            └────────┼─────────────┼──────────┼──────────┘
                     ▼             ▼          ▼
               StorageProvider  MongoDB    Redis (BullMQ queue "document-processing")
                     ▲             ▲          │
            ┌────────┼─────────────┼──────────┼──────────┐
            │ DocumentProcessingService ◄── BullMQ consumer │
            └──────────── Worker process (worker.ts) ────────┘
```

The worker is a separate entry point (`NestFactory.createApplicationContext`, no HTTP server).
Locally it runs with `npm run start:worker:dev`; in spec 006 the same service runs inside a Lambda
fed by SQS.

## Module map

```
src/
├── processing/
│   ├── queue/                    QueueProvider + BullMQ producer (used by the API)
│   │   ├── queue.provider.ts
│   │   ├── bullmq-queue.provider.ts
│   │   ├── document-job.ts       { documentId }
│   │   └── queue.module.ts
│   ├── extraction/               text extractors by MIME type
│   │   ├── text-extractor.ts     abstract TextExtractor
│   │   ├── pdf-text-extractor.ts unpdf
│   │   └── text-extractor.registry.ts
│   ├── errors/                   UnreadableDocumentError (permanent)
│   ├── document-processing.service.ts   transport-agnostic worker logic
│   ├── bullmq-document.consumer.ts      BullMQ adapter → service
│   └── processing.module.ts
├── worker.module.ts / worker.ts  worker entry point
└── documents/ …                  uses QueueModule
```

Module dependencies (no cycles):

- `DocumentsModule` → `QueueModule`, `StorageModule`, `DocumentPersistenceModule`
- `ProcessingModule` → `QueueModule` (connection), `StorageModule`, `DocumentPersistenceModule`
- `QueueModule` depends on nothing from `documents`.

## Configuration (new variables)

| Variable                  | Type        | Default     |
| ------------------------- | ----------- | ----------- |
| `QUEUE_DRIVER`            | `bullmq`    | `bullmq`    |
| `REDIS_HOST`              | string      | `localhost` |
| `REDIS_PORT`              | int         | `6379`      |
| `PROCESSING_MAX_ATTEMPTS` | int 1–10    | `3`         |
| `PROCESSING_BACKOFF_MS`   | int ≥ 100   | `5000`      |
| `WORKER_CONCURRENCY`      | int 1–20    | `2`         |


## Abstractions

```ts
abstract class QueueProvider {
  abstract enqueue(job: DocumentJob): Promise<void>;
}

abstract class TextExtractor {
  abstract extract(content: Buffer): Promise<ExtractedText>; // { text, pageCount }
}
```

`QueueModule` selects the producer by `QUEUE_DRIVER` with the same map + `moduleRef.create()`
pattern as `StorageModule`. `TextExtractorRegistry.forMimeType(mimeType)` returns the extractor or
`null` (images).

## Domain changes

`DocumentEntity` gains:

| Field            | Type             | Notes                                   |
| ---------------- | ---------------- | --------------------------------------- |
| `textStorageKey` | `string \| null` | `${id}.txt`; internal, never returned   |
| `pageCount`      | `number \| null` | `null` for images and while not ready   |
| `failureReason`  | `string \| null` | user-safe message, set only on `failed` |

`DocumentRepository` gains `update(id, changes)` and `delete(id)`. Text is stored as a file, not in
the record, because DynamoDB items are limited to 400 KB (spec 006).

## Upload flow (changed)

```
save file → create record (pending) → enqueue({ documentId })
                                         └─ on failure: delete record, delete file, throw 503
```

BullMQ `jobId = documentId` gives idempotent enqueueing (AC-1.2).

## Processing flow

```
DocumentProcessingService.process(documentId)
  1. document = repository.findById      → missing: warn, return            (AC-2.5)
  2. status is ready | failed            → skip, return                     (AC-2.6)
  3. update status = processing                                             (AC-2.1)
  4. content = storage.read(storageKey)
  5. extractor = registry.forMimeType(mimeType)
       none (image) → update ready, pageCount null                          (AC-2.3)
  6. { text, pageCount } = extractor.extract(content)
       parse error → throw UnreadableDocumentError                          (AC-3.2)
  7. storage.save(`${id}.txt`, text)
  8. update ready, pageCount, textStorageKey                                (AC-2.2, 2.4)

DocumentProcessingService.markFailed(documentId, reason)                    (AC-3.3)
```

`StorageProvider` gains `read(key): Promise<Buffer>`.

## BullMQ consumer

- Job options on enqueue: `attempts = PROCESSING_MAX_ATTEMPTS`,
  `backoff = { type: 'exponential', delay: PROCESSING_BACKOFF_MS }`, `removeOnComplete`,
  bounded `removeOnFail`.
- `process(job)` calls the service inside a `try`. On error it decides whether the job is
  finished: the error is permanent (`UnreadableDocumentError`) or this was the last attempt
  (`job.attemptsMade + 1 >= job.opts.attempts`). If finished, it awaits `markFailed` and rethrows a
  BullMQ `UnrecoverableError` so no more attempts run; otherwise it rethrows the original error so
  BullMQ retries with backoff.
- `markFailed` runs inside the job, not in the worker `failed` event, so it is awaited while the
  job holds its lock and is not lost if the process stops right after.
- Only `UnreadableDocumentError` messages reach clients; anything else becomes
  "Processing failed. Try uploading the file again."
- Concurrency comes from `WORKER_CONCURRENCY`, applied to the worker on module init.

## API changes

`DocumentResponseDto` adds `pageCount` and `failureReason`. `POST /documents` can now answer `503`.

## Testing strategy

- Unit: `DocumentProcessingService` (every branch above, mocked ports), `PdfTextExtractor` against
  a small fixture PDF, `TextExtractorRegistry`, `BullmqQueueProvider` (mocked queue: job id and
  options), consumer failure handling, `LocalStorageProvider.read`.
- e2e: `QueueProvider` overridden with an in-memory fake; checks the job is enqueued and the `503`
  rollback. No Redis needed.
- Manual: Docker Redis + API + worker; upload a PDF and watch it reach `ready`.

## Decisions

- **Separate worker process** instead of a processor inside the API: mirrors the AWS layout
  (API Lambda + worker Lambda) and keeps heavy work off the HTTP process.
- **unpdf** instead of pdf-parse 2: no native canvas binary, built for serverless, which matters
  for the Lambda package size in spec 006.
- **Images skip text extraction**: OCR (tesseract.js) is heavy and slow; spec 003 sends images to a
  vision-capable model instead.
- **Text in storage, not in the database**: portable to DynamoDB's item size limit.

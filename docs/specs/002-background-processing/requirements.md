# 002 — Background processing: requirements

> Phase 2 (week 2) of the DocuIA roadmap.
> Deliverable: an uploaded document is processed on its own and its status changes without
> blocking the API.

## Context

Spec 001 stores documents as `pending`. This spec adds a job queue and a worker that extracts the
text of each document, so later phases (LLM extraction, questions) can work on plain text.

## Scope

In scope:

- Enqueue a processing job when a document is uploaded.
- A worker process, separate from the API, that consumes the queue.
- Text extraction for PDFs; extracted text stored through `StorageProvider`.
- Retries with backoff, permanent failures and status transitions.
- Expose `pageCount` and `failureReason` in the document representation.

Out of scope: OCR for images (images are read by the LLM with vision in spec 003), SQS and Lambda
(spec 006), real-time status push (the web client polls).

## User stories and acceptance criteria

### US-1 — Documents are queued on upload

- **AC-1.1** WHEN a document is uploaded, THE SYSTEM SHALL enqueue one processing job identified by
  the document id and respond without waiting for processing.
- **AC-1.2** WHEN the same document id is enqueued twice, THE SYSTEM SHALL keep a single job.
- **AC-1.3** WHEN the job cannot be enqueued, THE SYSTEM SHALL delete the stored file and the
  document record and respond `503`.

### US-2 — The worker processes documents

- **AC-2.1** WHEN the worker takes a job, THE SYSTEM SHALL set the document to `processing`.
- **AC-2.2** WHEN the document is a PDF, THE SYSTEM SHALL extract its text, store it, record the
  page count and set the document to `ready`.
- **AC-2.3** WHEN the document is an image, THE SYSTEM SHALL set it to `ready` without extracted
  text and with `pageCount` `null`.
- **AC-2.4** WHEN the PDF has no extractable text (for example, a scanned PDF), THE SYSTEM SHALL
  set it to `ready` with empty text; it is not an error.
- **AC-2.5** WHEN the job refers to a document that no longer exists, THE SYSTEM SHALL discard the
  job and log a warning.
- **AC-2.6** WHEN the document is already `ready` or `failed`, THE SYSTEM SHALL skip it (jobs are
  idempotent).

### US-3 — Failures are retried, then reported

- **AC-3.1** WHEN processing fails with a transient error (for example, storage unavailable),
  THE SYSTEM SHALL retry up to `PROCESSING_MAX_ATTEMPTS` with exponential backoff, keeping the
  document in `processing`.
- **AC-3.2** WHEN the file is corrupt or unreadable, THE SYSTEM SHALL fail without retrying.
- **AC-3.3** WHEN the last attempt fails, THE SYSTEM SHALL set the document to `failed` with a
  user-safe `failureReason`.

### US-4 — Clients see the result

- **AC-4.1** THE SYSTEM SHALL include `pageCount` (number or `null`) and `failureReason` (string or
  `null`) in every document representation.
- **AC-4.2** THE SYSTEM SHALL NOT expose storage keys or raw error stacks.

## Non-functional requirements

- **NFR-1** The queue sits behind `QueueProvider`; the worker logic does not depend on BullMQ, so
  spec 006 can run it from an SQS-triggered Lambda.
- **NFR-2** No circular dependencies between modules.
- **NFR-3** Unit tests for the processing service, the extractors and the queue adapter; e2e tests
  run without Redis.
- **NFR-4** Logs include `documentId`, the attempt number and the outcome.

# 001 — Project foundation: tasks

Each task references the acceptance criteria it satisfies.

- [x] **T1** Tooling: `.nvmrc`, `docker-compose.yml` (MongoDB + Redis), `.env.example`, install
      dependencies.
- [x] **T2** `config` module: Zod env schema + `validate` function + unit tests. (AC-4.2)
- [x] **T3** Global `HttpExceptionFilter` + unit tests. (AC-4.3)
- [x] **T4** `health` module: `GET /health`. Remove the scaffold's `AppController`/`AppService`.
      (AC-4.1)
- [x] **T5** `storage` module: `StorageProvider`, `LocalStorageProvider`, driver selection + unit
      tests. (NFR-2)
- [x] **T6** `documents` domain: status enum, entity, `DocumentRepository`, Mongoose schema,
      `MongoDocumentRepository`. (NFR-1, NFR-2)
- [x] **T7** `DocumentsService` (upload with compensation, findById, findRecent) + unit tests.
      (AC-1.1, AC-1.5, AC-2.3, AC-3.1)
- [x] **T8** `DocumentsController` + DTOs + file validation + Swagger decorators. (AC-1.2–1.4,
      AC-2.2, AC-3.2, AC-4.4)
- [x] **T9** `main.ts`: ValidationPipe, filter, CORS, Swagger. (AC-4.4, AC-4.5)
- [x] **T10** e2e tests for every endpoint with in-memory repository. (NFR-3)
- [x] **T11** README "Getting started" section; run lint, tests, e2e, build. (NFR-4)

## Verification log

- 2026-10-22 — lint clean; 21 unit tests and 13 e2e tests pass; build OK. Manual smoke test
  against MongoDB in Docker: upload → `pending`, get, list, Swagger and CORS verified.
- Bug found by e2e during T10: `StorageModule` resolved the implementation with `moduleRef.get()`
  before Nest had constructed it. Reproduced in `storage.module.spec.ts`, fixed with
  `moduleRef.create()`.

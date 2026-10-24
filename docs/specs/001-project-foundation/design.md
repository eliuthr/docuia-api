# 001 — Project foundation: design

## Module map

```
src/
├── main.ts                      bootstrap: pipes, filter, CORS, Swagger
├── app.module.ts                wires feature modules
├── config/                      env schema (Zod) + typed access
├── common/filters/              global HttpExceptionFilter
├── health/                      GET /health
├── storage/                     StorageProvider + LocalStorageProvider
└── documents/                   controller → service → DocumentRepository
    ├── documents.{controller,service,module}.ts, documents.constants.ts
    ├── domain/                  entity, status enum, uploaded file type
    ├── dto/                     query + response DTOs
    ├── pipes/                   file validation pipe
    ├── repositories/            DocumentRepository, MongoDocumentRepository
    └── schemas/                 Mongoose schema
```

Dependency direction: `documents` → `storage`, `config`. No module depends on `documents`.

## Configuration

`ConfigModule.forRoot({ isGlobal: true, validate })` where `validate` parses `process.env` with a
Zod schema. A failed parse throws at startup with the list of invalid variables (AC-4.2).

| Variable             | Type                                | Default                 |
| -------------------- | ----------------------------------- | ----------------------- |
| `NODE_ENV`           | `development` \| `test` \| `production` | `development`       |
| `PORT`               | int                                 | `3000`                  |
| `CORS_ORIGIN`        | URL                                 | `http://localhost:4200` |
| `MONGODB_URI`        | string                              | — (required)            |
| `STORAGE_DRIVER`     | `local`                             | `local`                 |
| `LOCAL_STORAGE_DIR`  | string                              | `./uploads`             |
| `MAX_UPLOAD_SIZE_MB` | int 1–50                            | `10`                    |

Services read values through `ConfigService<Env, true>`, never `process.env`.

## Abstractions

Nest uses abstract classes as injection tokens, so each "interface" is an abstract class with no
implementation. That keeps type safety and avoids string tokens.

```ts
abstract class StorageProvider {
  abstract save(key: string, content: Buffer): Promise<void>;
  abstract delete(key: string): Promise<void>;
}

abstract class DocumentRepository {
  abstract create(document: NewDocument): Promise<DocumentEntity>;
  abstract findById(id: string): Promise<DocumentEntity | null>;
  abstract findRecent(limit: number): Promise<DocumentEntity[]>;
}
```

- `StorageModule` registers `StorageProvider` with a factory that looks up the implementation in a
  map keyed by `STORAGE_DRIVER` and builds it with `moduleRef.create()` (only the selected one is
  instantiated). Only `local` exists now; `s3` is added in spec 006 without touching services.
- `DocumentPersistenceModule` binds `DocumentRepository` to `MongoDocumentRepository`, and
  `DatabaseModule` owns the Mongo connection. e2e tests override both modules. The DynamoDB variant
  arrives in spec 006 with the same selection mechanism.

## Domain model

```ts
enum DocumentStatus { Pending = 'pending', Processing = 'processing', Ready = 'ready', Failed = 'failed' }

interface DocumentEntity {
  id: string;            // UUID v4, also the Mongo _id
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;    // `${id}${extension}`; internal, never returned to clients
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

## Upload flow

```
Controller  ── ParseFilePipe (size + type) ──►  DocumentsService.upload(file)
  1. id = randomUUID(); storageKey = id + extension(mimeType)
  2. storage.save(storageKey, file.buffer)
  3. repository.create({ …, status: pending })
       └─ on failure: storage.delete(storageKey), rethrow
  4. return DocumentResponseDto
```

- Multer keeps the file in memory with `limits.fileSize` from `MAX_UPLOAD_SIZE_MB` (registered via
  `MulterModule.registerAsync`), so an oversized upload is cut off with `413` before it is fully
  buffered (AC-1.3).
- Type check uses `FileTypeValidator` with the allowed MIME types (PDF, PNG, JPEG), which inspects
  the file's magic bytes (via `file-type`) and overrides the client-provided MIME type.
- The extension is derived from the validated MIME type, never from the client's filename.

## HTTP contract

| Method | Path             | Success | Errors        |
| ------ | ---------------- | ------- | ------------- |
| GET    | `/health`        | 200     | —             |
| POST   | `/documents`     | 201     | 400, 500      |
| GET    | `/documents`     | 200     | 400           |
| GET    | `/documents/:id` | 200     | 400, 404      |

`:id` goes through `ParseUUIDPipe`; `limit` through `ListDocumentsQueryDto` (class-validator).
A global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.

## Error handling

`HttpExceptionFilter` (global, `@Catch()`):

- `HttpException` → its status and message.
- Anything else → `500 Internal server error`, logged with the stack on the server only.
- Body: `{ statusCode, error, message, path, timestamp }`.

## Logging

Nest `Logger` with a context per class. Upload logs `{ event: 'document.uploaded', documentId }`.

## Testing strategy

- Unit (Vitest): `DocumentsService` with mocked `StorageProvider` and `DocumentRepository`;
  `LocalStorageProvider` against a temp dir; env schema; exception filter.
- e2e (Vitest + supertest): full `AppModule` with `DocumentRepository` overridden by an
  `InMemoryDocumentRepository` (test helper) and `LOCAL_STORAGE_DIR` pointing to a temp dir. No
  MongoDB needed in CI.

## Local infrastructure

`docker-compose.yml` with `mongo:8` (port 27017, named volume) and `redis:8-alpine` (port 6379,
used from spec 002). `.env.example` lists every variable.

## Decisions

- **Zod for env validation** instead of Joi: Zod is already part of the stack (LLM output
  validation), so one validation library covers both.
- **Mongoose** via `@nestjs/mongoose`: first-class Nest integration; isolated inside
  `MongoDocumentRepository` so it never leaks into services.
- **UUID ids generated by the app**: portable to DynamoDB, no dependency on ObjectId.
- **oxlint** stays as the linter (the scaffold ships it and it runs `--type-aware`); Prettier
  formats.

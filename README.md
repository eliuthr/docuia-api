# DocuIA API

NestJS API that receives documents (invoices, contracts, résumés), processes them in the
background and uses an LLM with tool calling to extract data and answer questions about them.

> Status: phase 2 — background processing with a queue and a worker. See [`docs/specs`](docs/specs) for the
> spec-driven roadmap.

## Stack

Node.js 24 · NestJS 12 (ESM) · TypeScript 6 · MongoDB (Mongoose) · BullMQ + Redis · unpdf · Zod · Swagger · Vitest ·
oxlint + Prettier.

## Getting started

```bash
nvm use                 # Node 24
npm install
cp .env.example .env
docker compose up -d    # MongoDB + Redis
npm run start:dev         # API (terminal 1)
npm run start:worker:dev  # worker (terminal 2)
```

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/docs

## Endpoints

| Method | Path             | Description                                   |
| ------ | ---------------- | --------------------------------------------- |
| GET    | `/health`        | Liveness check                                |
| POST   | `/documents`     | Upload a PDF, PNG or JPEG (`file` form field) |
| GET    | `/documents`     | List recent documents (`?limit=1..100`)       |
| GET    | `/documents/:id` | Get a document and its processing status      |

```bash
curl -F "file=@invoice.pdf" http://localhost:3000/documents
```

## Architecture

Controllers validate input and delegate to services. Everything that differs between local and
AWS sits behind an injectable abstraction selected by configuration:

| Abstraction          | Local                  | AWS (planned) |
| -------------------- | ---------------------- | ------------- |
| `StorageProvider`    | `LocalStorageProvider` | S3            |
| `DocumentRepository` | MongoDB                | DynamoDB      |
| `QueueProvider`      | BullMQ (Redis)         | SQS           |

The API never processes documents inside the HTTP request: it stores the file, persists the
document as `pending`, enqueues a job and responds. A separate worker process consumes the queue:

```
pending → processing → ready    (PDF text extracted and stored; images skip extraction)
                     → failed   (corrupt file: no retry · transient error: retried with backoff)
```

The worker logic (`DocumentProcessingService`) does not depend on BullMQ, so the same code can run
from an SQS-triggered Lambda on AWS.

## Scripts

| Command                    | Description                            |
| -------------------------- | -------------------------------------- |
| `npm run start:dev`        | API in watch mode                      |
| `npm run start:worker:dev` | Worker in watch mode                   |
| `npm run lint`             | oxlint (type-aware)                    |
| `npm run test`             | Unit tests                             |
| `npm run test:e2e`         | e2e tests (no MongoDB or Redis needed) |
| `npm run build`            | Production build                       |

## Configuration

All variables are validated with Zod at startup; see [`.env.example`](.env.example).

# DocuIA API

NestJS API that receives documents (invoices, contracts, résumés), processes them in the
background and uses an LLM with tool calling to extract data and answer questions about them.

> Status: phase 3 — LLM classification and structured data extraction. See [`docs/specs`](docs/specs) for the
> spec-driven roadmap.

## Stack

Node.js 24 · NestJS 12 (ESM) · TypeScript 6 · MongoDB (Mongoose) · BullMQ + Redis · unpdf · OpenAI (GPT-6 Luna) · Zod · Swagger · Vitest ·
oxlint + Prettier.

## Getting started

```bash
nvm use                 # Node 24
npm install
cp .env.example .env     # then set OPENAI_API_KEY
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
| `LlmProvider`        | OpenAI                 | OpenAI        |

The API never processes documents inside the HTTP request: it stores the file, persists the
document as `pending`, enqueues a job and responds. A separate worker process consumes the queue:

```
pending → processing → ready    (text extracted, document classified, data extracted)
                     → failed   (corrupt file or invalid LLM output: no retry ·
                                 transient error: retried with backoff)
```

### LLM extraction

The worker sends the PDF text (or the image itself, using vision) to the LLM in two steps:

1. **Classify** the document as `invoice`, `contract`, `resume` or `other`.
2. **Extract** its data with the Zod schema for that type (skipped for `other`).

The model is asked for strict structured output (JSON Schema generated from Zod), and every
response is validated again with Zod before it is stored. An invalid response is retried once and
then the document is marked `failed`. Missing fields are `null`, never invented. Results are
returned as `documentType` and `extractedData` in `GET /documents/:id`.

Cost controls: cheap model by default, input truncated to `LLM_MAX_INPUT_CHARS`, bounded output
tokens and no SDK-level retries. Tests never call the API: the LLM is always mocked.

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

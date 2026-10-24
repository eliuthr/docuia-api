# DocuIA API

NestJS API that receives documents (invoices, contracts, résumés), processes them in the
background and uses an LLM with tool calling to extract data and answer questions about them.

> Status: phase 4 — questions with tool calling and streamed answers. See [`docs/specs`](docs/specs) for the
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

| Method | Path                 | Description                                    |
| ------ | -------------------- | ---------------------------------------------- |
| GET    | `/health`            | Liveness check                                 |
| POST   | `/documents`         | Upload a PDF, PNG or JPEG (`file` form field)  |
| GET    | `/documents`         | List recent documents (`?limit=1..100`)        |
| GET    | `/documents/:id`     | Get a document and its processing status       |
| POST   | `/documents/:id/ask` | Ask about one document (SSE stream)            |
| POST   | `/ask`               | Ask about all processed documents (SSE stream) |

```bash
curl -F "file=@invoice.pdf" http://localhost:3000/documents
curl -N -H "Content-Type: application/json" \
  -d '{"question":"How much do the invoices from ACME add up to?"}' \
  http://localhost:3000/ask
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

Each document also gets a `summary` of up to three sentences, generated in the same call that
classifies it.

### Questions and tool calling

`POST /ask` and `POST /documents/:id/ask` answer questions in natural language. The model does not
answer from memory: it calls DocuIA's tools and answers from their results.

| Tool                   | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `get_document_details` | Type, summary and extracted data of one document               |
| `search_document_text` | Keyword search over a document's text (accent-insensitive)     |
| `find_documents`       | Lists documents by type and by vendor, party or candidate name |
| `sum_invoice_totals`   | Adds up invoice totals by currency, in code (not by the model) |

A small loop (`ToolLoopService`) sends the question, runs the tools the model asks for, returns
their results and repeats, up to `AGENT_MAX_ITERATIONS` turns; the last turn has no tools, so the
model must answer. Tool arguments are validated with Zod, and errors go back to the model as tool
results so it can correct itself.

Answers are streamed with Server-Sent Events: `tool` (a tool is being used), `delta` (a piece of
the answer), `done` and `error`. Since the endpoints are `POST`, browsers read the stream with
`fetch` instead of `EventSource`. If the client disconnects, the model request is aborted.

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

# DocuIA API

NestJS API that receives documents (invoices, contracts, résumés), processes them in the
background and uses an LLM with tool calling to extract data and answer questions about them.

> Status: phase 5 — LangGraph.js agent with answer verification and conversation history. See [`docs/specs`](docs/specs) for the
> spec-driven roadmap.

## Stack

Node.js 24 · NestJS 12 (ESM) · TypeScript 6 · MongoDB (Mongoose) · BullMQ + Redis · unpdf · OpenAI (GPT-6 Luna) · LangGraph.js · Zod · Swagger · Vitest ·
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
| GET    | `/documents`         | Page of documents (`?limit=1..100&cursor=`)    |
| GET    | `/documents/events`  | Stream status changes (SSE)                    |
| GET    | `/documents/:id`     | Get a document and its processing status       |
| POST   | `/documents/:id/ask` | Ask about one document (SSE stream)            |
| POST   | `/ask`               | Ask about all processed documents (SSE stream) |
| GET    | `/conversations`     | Recent conversations (`?documentId=`)          |
| GET    | `/conversations/:id` | A conversation with all its messages           |

```bash
curl -F "file=@invoice.pdf" http://localhost:3000/documents
curl -N -H "Content-Type: application/json" \
  -d '{"question":"How much do the invoices from ACME add up to?"}' \
  http://localhost:3000/ask
```

## Architecture

Controllers validate input and delegate to services. Everything that differs between local and
AWS sits behind an injectable abstraction selected by configuration:

| Abstraction              | Local                  | AWS (planned) |
| ------------------------ | ---------------------- | ------------- |
| `StorageProvider`        | `LocalStorageProvider` | S3            |
| `DocumentRepository`     | MongoDB                | DynamoDB      |
| `ConversationRepository` | MongoDB                | DynamoDB      |
| `QueueProvider`          | BullMQ (Redis)         | SQS           |
| `LlmProvider`            | OpenAI                 | OpenAI        |

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

### The agent (LangGraph.js)

Questions are answered by a [LangGraph.js](https://langchain-ai.github.io/langgraphjs/) graph.
Each node does one step and conditional edges decide the next one:

```
START → classify ──conversational──► respond ──────────────────────► END
           └──► callModel ⇄ runTools
                    └──► verify ──unsupported (once)──► revise ──► callModel
                            └──► emitAnswer ─────────────────────────► END
```

1. **Classify** the question (`lookup`, `text_search`, `calculation`, `conversational`) with a
   Zod-validated output. Each category offers the model only the tools it needs.
2. **Call the model and run tools** until it answers, up to `AGENT_MAX_ITERATIONS` turns
   (revisions included); the last turn has no tools, so the model must answer. Tool arguments are
   validated with Zod, and errors go back to the model as tool results.
3. **Verify** the draft against the tool results (every amount, name and date must be in them).
   An unsupported draft is revised once with the verifier's feedback.

The nodes call DocuIA's own `LlmProvider`, not LangChain model classes, so the provider is still
chosen by configuration. If the classification or the verdict fails validation twice, the agent
falls back (all tools / unverified draft) and logs it instead of failing the question.

### Conversations

Every answer belongs to a conversation, about one document or about the whole collection. The
first SSE event carries its id; sending it back as `conversationId` continues the conversation,
and the last 10 messages are given to the agent so follow-ups ("and the other one?") work. Only
questions and final answers are stored, one record per message, so a conversation never becomes
one large item (DynamoDB limits items to 400 KB).

Answers are streamed with Server-Sent Events: `conversation` (its id), `status` (`classifying`,
`answering`, `verifying`, `revising`), `tool` (a tool is being used), `delta` (answer text),
`done` and `error`. A verified answer is sent after the verification; conversational replies are
streamed as they are written. Since the endpoints are `POST`, browsers read the stream with
`fetch` instead of `EventSource`. If the client disconnects, the model request is aborted.

Cost controls: cheap model by default, input truncated to `LLM_MAX_INPUT_CHARS`, bounded output
tokens and no SDK-level retries. Tests never call the API: the LLM is always mocked.

Every status change is published by the worker on a Redis pub/sub channel and pushed to browsers
through `GET /documents/events` (Server-Sent Events), so the web client refreshes only when
something changed instead of polling.

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

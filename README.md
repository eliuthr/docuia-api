# DocuIA API

NestJS API that receives documents (invoices, contracts, résumés), processes them in the
background and uses an LLM with tool calling to extract data and answer questions about them.

> Status: phase 1 — upload and status lookup. See [`docs/specs`](docs/specs) for the
> spec-driven roadmap.

## Stack

Node.js 24 · NestJS 12 (ESM) · TypeScript 6 · MongoDB (Mongoose) · Zod · Swagger · Vitest ·
oxlint + Prettier.

## Getting started

```bash
nvm use                 # Node 24
npm install
cp .env.example .env
docker compose up -d    # MongoDB + Redis
npm run start:dev
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

The API never processes documents inside the HTTP request: it stores the file, persists the
document as `pending` and responds.

## Scripts

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `npm run start:dev`| Development server (watch mode)   |
| `npm run lint`     | oxlint (type-aware)               |
| `npm run test`     | Unit tests                        |
| `npm run test:e2e` | e2e tests (no database required)  |
| `npm run build`    | Production build                  |

## Configuration

All variables are validated with Zod at startup; see [`.env.example`](.env.example).

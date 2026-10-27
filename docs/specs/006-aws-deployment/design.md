# 006 — AWS deployment: design

## Architecture on AWS

```
browser / curl
     │ HTTPS (function URL, response streaming, auth NONE until spec 007)
     ▼
┌──────────────────────────────┐  SendMessage  ┌───────────┐  event source  ┌──────────────────────┐
│ docuia-api Lambda (arm64)    │──────────────►│ SQS queue │───────────────►│ docuia-worker Lambda │
│ Lambda Web Adapter layer     │               └─────┬─────┘  batch size 1  │ sqs-worker.handler   │
│ node dist/main.js (NestJS)   │                     │ after 3 receives     └──────────┬───────────┘
└───┬───────────────┬──────────┘                     ▼                                 │
    │               │                          ┌───────────┐                           │
    │               │                          │    DLQ    │                           │
    ▼               ▼                          └───────────┘                           │
┌────────┐   ┌──────────────────────────────┐                                          │
│   S3   │   │ DynamoDB: documents,         │◄─────────────────────────────────────────┤
│ bucket │◄──│ conversations, messages      │                                          │
└────────┘   └──────────────────────────────┘          OpenAI API (internet) ◄─────────┘
                       CloudWatch Logs (7 days) ◄── both Lambdas
```

No VPC: Lambda reaches S3, SQS, DynamoDB and OpenAI over the AWS network and the internet, so
there is no NAT Gateway (which costs about 32 USD per month).

Concepts:

- **Function URL**: an HTTPS endpoint that belongs to one Lambda function. With invoke mode
  `RESPONSE_STREAM`, the response is sent while it is written (needed for SSE), for up to 15
  minutes.
- **Lambda Web Adapter (LWA)**: an AWS layer that starts the normal NestJS server inside Lambda
  and translates Lambda invocations into HTTP requests to it, so `main.ts` does not change.
- **Event source mapping**: Lambda polls the SQS queue and invokes the worker with the messages.
  A message that is not deleted comes back after the visibility timeout; after
  `maxReceiveCount` receives it moves to the dead-letter queue (DLQ).
- **Provisioned capacity**: DynamoDB tables with a fixed number of read/write units per second.
  25 units of each are free forever; on-demand mode is billed per request.

## Driver selection

| Variable          | Local (default) | AWS        | Module chosen                                |
| ----------------- | --------------- | ---------- | -------------------------------------------- |
| `DATABASE_DRIVER` | `mongodb`       | `dynamodb` | `DatabaseModule`, both persistence modules   |
| `STORAGE_DRIVER`  | `local`         | `s3`       | `StorageModule`                              |
| `QUEUE_DRIVER`    | `bullmq`        | `sqs`      | `QueueModule` (producer); worker entry point |
| `EVENTS_DRIVER`   | `redis`         | `none`     | events publisher and subscriber modules      |

Each infrastructure module becomes a thin module that imports one driver module with
`ConditionalModule.registerWhen` (from `@nestjs/config`), through a shared helper:

```ts
// src/common/modules/import-for-driver.ts
importForDriver('DATABASE_DRIVER', {
  mongodb: MongoDatabaseModule,
  dynamodb: DynamoDbDatabaseModule,
});
```

Only the selected driver module is loaded, so Mongoose, BullMQ and ioredis never open a
connection on AWS (AC-1.2). The driver modules are `@Global()`: Nest cannot re-export what comes
from an asynchronous import, so the façade module only imports them. `ConditionalModule` decides
when the module file is imported, so the variables must exist before the app is imported (true
on Lambda; the wiring test imports the root modules after setting them). Storage keeps
`provideByDriver`, since creating an `S3Client` opens no connection. The module names that e2e tests override (`DatabaseModule`,
`DocumentPersistenceModule`, `ConversationPersistenceModule`, `QueueModule`,
`DocumentEventsSubscriberModule`) stay the same.

Environment validation becomes a refinement on the Zod schema: `MONGODB_URI` is required with
`mongodb`; `S3_BUCKET` with `s3`; `SQS_QUEUE_URL` with `sqs`; the three table names with
`dynamodb` (AC-1.3).

## New environment variables

| Variable                       | Used with  | Notes                                    |
| ------------------------------ | ---------- | ---------------------------------------- |
| `DATABASE_DRIVER`              | always     | `mongodb` (default) or `dynamodb`        |
| `AWS_REGION`                   | AWS        | set by Lambda; local default `us-east-1` |
| `S3_BUCKET`                    | `s3`       | set by CDK                               |
| `SQS_QUEUE_URL`                | `sqs`      | set by CDK                               |
| `DYNAMODB_DOCUMENTS_TABLE`     | `dynamodb` | set by CDK                               |
| `DYNAMODB_CONVERSATIONS_TABLE` | `dynamodb` | set by CDK                               |
| `DYNAMODB_MESSAGES_TABLE`      | `dynamodb` | set by CDK                               |

`MAX_UPLOAD_SIZE_MB` is set to 5 on AWS (AC-6.3). `CORS_ORIGIN` stays configurable. `LOG_FORMAT`
(`pretty` | `json`) is `json` on AWS.

## Module map

```
src/common/modules/import-for-driver.ts      ConditionalModule per driver value
src/common/aws/aws-clients.module.ts         S3Client, SQSClient, DynamoDBDocumentClient providers
src/database/
├── database.module.ts                       imports Mongo or DynamoDB root module
├── mongo-database.module.ts                 (current MongooseModule.forRootAsync)
└── dynamodb-database.module.ts              DynamoDBDocumentClient + table names
src/storage/s3-storage.provider.ts           PutObject / GetObject / DeleteObject
src/processing/queue/sqs-queue.provider.ts   SendMessage { documentId }
src/processing/document-job.runner.ts        one attempt + retry decision, shared by BullMQ and SQS (NFR-5)
src/processing/sqs-document.consumer.ts      SQS record → DocumentJobRunner
src/processing/processing-core.module.ts     DocumentProcessingService, DocumentJobRunner and dependencies
src/processing/processing.module.ts          core + BullMQ consumer (local worker)
src/lambda/sqs-worker.handler.ts             Lambda entry point for the worker
src/lambda/process-sqs-event.ts              batch → partial batch response
src/lambda/lambda-worker.module.ts           config, database and processing core, no HTTP
src/common/logging/create-app-logger.ts      LOG_FORMAT=json on AWS for CloudWatch
src/documents/repositories/
├── document-persistence.module.ts           imports Mongo or DynamoDB persistence module
├── dynamodb-document.repository.ts
└── dynamodb-document.mapper.ts              entity ⇄ item, cursor ⇄ ExclusiveStartKey
src/conversations/repositories/
├── dynamodb-conversation.repository.ts
└── dynamodb-conversation.mapper.ts
src/documents/events/
├── noop-document-events.publisher.ts
└── unavailable-document-events.subscriber.ts   events() errors → controller responds 503
infra/                                       separate package.json (CDK)
├── bin/docuia.ts
├── lib/docuia-stack.ts
├── lib/docuia-stack.test.ts                 CDK assertions
└── scripts/package-lambda.mjs               dist + production node_modules → .lambda/
docs/aws-setup.md                            account, MFA, budget, CLI credentials, deploy
```

## DynamoDB data model

| Table           | Partition key    | Sort key            | GSI                                                                        |
| --------------- | ---------------- | ------------------- | -------------------------------------------------------------------------- |
| `documents`     | `id`             | —                   | `byCreatedAt`: `listKey` = `"DOCUMENT"`, `createdAtId` = `<ISO date>#<id>` |
| `conversations` | `id`             | —                   | `byScope`: `scopeKey` = document id or `"COLLECTION"`, `updatedAt`         |
| `messages`      | `conversationId` | `sequence` (number) | —                                                                          |

- **Document pages** query `byCreatedAt` newest first (`ScanIndexForward: false`) with
  `Limit: limit + 1`; the cursor becomes the `ExclusiveStartKey`
  (`{ id, listKey, createdAtId }`). The API cursor format does not change.
- **Document search** queries `byCreatedAt` newest first and filters status, type and text in
  code (case- and accent-insensitive, same fields as Mongo), reading at most
  `DYNAMODB_SEARCH_SCAN_LIMIT` (200) items. DynamoDB has no text search; this is enough for a
  portfolio-sized collection and is documented as a limit.
- **Conversation lists** query `byScope` newest first and skip conversations with no messages.
- **Messages** use a per-conversation `sequence` (the current `messageCount` + position), so
  order is exact even when two messages share a timestamp. `appendMessages` writes the messages
  and the new `messageCount` in one `TransactWriteItems`, on the condition that `messageCount`
  has not changed (optimistic concurrency).
- **One partition for the document list** (`listKey`) is a hot-partition risk at large scale;
  at this size it is fine, and it keeps ordering exact.

Capacity (AC-4.3): every table and GSI uses 5 read and 5 write units: 3 tables + 2 GSIs = 25
each.

## Worker on Lambda

```ts
// src/lambda/sqs-worker.handler.ts
let appContext: Promise<INestApplicationContext> | undefined; // reused while the Lambda is warm

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> { … }
```

- Batch size 1 and `reportBatchItemFailures`: a failed message is returned in
  `batchItemFailures` and comes back after the visibility timeout.
- `ApproximateReceiveCount` is the attempt number. `DocumentJobRunner` (shared with the BullMQ
  consumer) returns `done`, `retry` or `failed`; `failed` means the document is already marked
  and the message is deleted. A malformed message body is logged and dropped.
- The worker Lambda timeout is 120 s; the queue visibility timeout is 6 × 120 s, as AWS
  recommends for event source mappings; `maxReceiveCount` is `PROCESSING_MAX_ATTEMPTS + 1`, so
  the handler always gets a last attempt to mark the document before the DLQ.
- SQS has no exponential backoff: a retry waits for the visibility timeout. Acceptable for
  documents.

## API on Lambda

- Runtime `nodejs24.x`, arm64 (about 20 % cheaper per GB-second), 1024 MB, timeout 120 s.
- LWA layer `LambdaAdapterLayerArm64` with `AWS_LAMBDA_EXEC_WRAPPER=/opt/bootstrap`,
  `AWS_LWA_INVOKE_MODE=response_stream`, `AWS_LWA_READINESS_CHECK_PATH=/health`, `PORT=8080`,
  and handler `run.sh` (`exec node dist/main.js`).
- Function URL with `InvokeMode.RESPONSE_STREAM`, `AuthType.NONE` and CORS left to NestJS.
- `GET /documents/events` responds `503` (AC-5.1): a long-lived SSE connection would keep a
  Lambda running for up to 15 minutes per open tab and use up the free compute.

## Packaging

`infra/scripts/package-lambda.mjs` (Node, works on Windows) builds one zip that both Lambdas use:

1. `npm run build` in the API.
2. Copies `dist/`, `package.json` and `package-lock.json` to `infra/.lambda-build/staging` and
   writes `run.sh` (`exec node dist/main.js`) with LF line endings.
3. `npm ci --omit=dev --ignore-scripts --os=linux --cpu=arm64` there.
4. Removes `*.d.ts`, `*.d.mts`, `*.d.cts`, `*.map` and `*.md` from `node_modules` (never
   executed; about half of the size: 243 MB → 104 MB) and fails if the result is over a
   200 MB budget (Lambda allows 250 MB unzipped, layers included).
5. Zips it inside a Linux container (`alpine` from ECR Public), because zips made on Windows do
   not keep the executable bit that `run.sh` needs. CDK uploads the zip as-is.

The ZIP path is shared through `infra/lambda-package.json`. esbuild bundling is not used because
NestJS needs `emitDecoratorMetadata`, which esbuild does not support. `@nestjs/swagger` declares
`typescript` as a production dependency, which accounts for 23 MB of the package.

## Web client hosting

`WebHosting` (`infra/lib/web-hosting.ts`) serves the Angular build of `docuia-web` from the same
stack:

- A private S3 bucket (all public access blocked). Only the CloudFront distribution can read it,
  through an **Origin Access Control (OAC)**: CloudFront signs its requests to S3 and the bucket
  policy accepts only that distribution.
- CloudFront redirects HTTP to HTTPS, uses price class 100 and answers `403` and `404` with
  `/index.html` (status `200`), so a reload of a deep link such as `/documents/123` reaches the
  Angular router. S3 returns `403`, not `404`, for a missing key when the reader cannot list the
  bucket.
- A `BucketDeployment` uploads the build plus `config.json` (`{ "apiBaseUrl": <function URL> }`),
  written at deploy time because the function URL does not exist before the first deploy. It
  invalidates `/*` (one invalidation path per deploy; 1000 per month are free).
- The API's `CORS_ORIGIN` is `https://<distribution domain>`, so the stack wires both ends
  without manual configuration.
- The web client reads `config.json` before bootstrapping when its environment has no fixed
  `apiBaseUrl` (production build); the development build keeps `http://localhost:3000`.
- The bucket only holds build output, so it is destroyed with the stack (`autoDeleteObjects`).

`scripts/build-web.mjs` runs `npm run build` in the sibling `docuia-web` repository (path in
`infra/web-app.json`); `npm run deploy` runs it before `cdk deploy`.

## Secrets

`cdk deploy` reads `OPENAI_API_KEY` from the shell and sets it as a Lambda environment variable,
encrypted at rest by Lambda. It is never written to the repository, `cdk.out` is git-ignored, and
the stack has no output that contains it (AC-6.5). Moving it to SSM Parameter Store
(free standard tier) is a follow-up.

## Cost guardrails

- Zero-spend budget and an 80 % alert on a 5 USD budget, created in the console before the
  first deploy (`docs/aws-setup.md`).
- Log groups with 7-day retention.
- No IAM Identity Center or AWS Organizations (they can move the account to the paid plan).
- Until spec 007 the function URL is public: do not share it, set a usage limit in the OpenAI
  dashboard, and `cdk destroy` when the demo is over.
- `RemovalPolicy.RETAIN` for the bucket and tables (AC-6.4).

## Testing strategy

- Unit: each AWS implementation with `aws-sdk-client-mock` (commands sent, item mapping,
  pagination keys, missing items, `TransactWriteItems`), the mappers, `DocumentJobRunner`, the
  SQS consumer and batch handling, `importForDriver`, the env refinements, the `none` events
  driver, and an AWS wiring test that compiles the API and the Lambda worker with the AWS
  drivers and checks that no MongoDB connection exists.
- e2e: `GET /documents/events` responds `503` with the `none` subscriber.
- CDK: `infra/lib/docuia-stack.test.ts` with `aws-cdk-lib/assertions` (function URL streaming,
  no VPC, capacity totals, DLQ, log retention, retained tables, least-privilege grants).
- e2e: unchanged; they keep the in-memory doubles.
- Manual: deploy to a new account, upload the sample documents, ask questions, check
  CloudWatch logs and the billing dashboard.

## Decisions

- **Function URL instead of API Gateway**: streaming through a function URL is documented and
  free; API Gateway REST streaming could not be confirmed with LWA. API Gateway can be added in
  front later for rate limiting.
- **Lambda Web Adapter instead of a NestJS-to-Lambda wrapper**: NestJS keeps running as a normal
  HTTP server, the same code runs locally and on Lambda, and SSE works without changes.
- **Lambda Web Functions not used yet**: very recent, and it bills memory while idle.
- **Three tables instead of single-table design**: each repository maps to its own table, which
  is easier to read and to explain; single-table design is a later optimization.
- **No live events on AWS**: the web client already falls back to polling.
- **CloudFront + S3 instead of Netlify or Amplify Hosting**: one stack and one command for the
  whole application, and CloudFront's always-free tier (1 TB and 10 million requests per month).
- **Runtime `config.json` instead of a build-time URL**: the web client is built once and does
  not need a second deploy after the function URL is known.
- **CDK in its own package**: CDK libraries never end up in the Lambda bundle.

# 006 — AWS deployment: requirements

> Phase 6 (week 6) of the DocuIA roadmap.
> Deliverable: the API working on a public URL, with an AWS cost of zero.

## Context

DocuIA runs locally on MongoDB, Redis (BullMQ and pub/sub) and the local disk. Every one of those
already sits behind an abstraction (`StorageProvider`, `QueueProvider`, `DocumentRepository`,
`ConversationRepository`, `DocumentEventsPublisher`/`Subscriber`). This spec adds the AWS
implementation of each, selects them by configuration, and deploys the API and the worker as
Lambda functions with the AWS CDK.

## Scope

In scope:

- AWS implementations: S3 storage, SQS queue, DynamoDB repositories (documents and
  conversations), and a `none` events driver.
- Choosing whole infrastructure modules by configuration, so the AWS deployment never connects
  to MongoDB or Redis.
- The worker as an SQS-triggered Lambda; the API as a Lambda with a function URL and response
  streaming (Lambda Web Adapter).
- Infrastructure as code with the AWS CDK (TypeScript) in `infra/`.
- A step-by-step account setup guide (account, MFA, budget alert, CLI credentials).
- Logs in CloudWatch with a short retention.

Out of scope: authentication (spec 007; until then the URL must not be shared), CI/CD (spec 007),
hosting the web client on AWS, direct uploads to S3 with presigned URLs, live status events on
AWS, a custom domain.

## User stories and acceptance criteria

### US-1 — Same code, two environments

- **AC-1.1** THE SYSTEM SHALL select storage (`local` | `s3`), queue (`bullmq` | `sqs`),
  database (`mongodb` | `dynamodb`) and events (`redis` | `none`) with environment variables,
  without `if` statements in services.
- **AC-1.2** WHEN a driver is not selected, THE SYSTEM SHALL NOT load its module or open its
  connection (no MongoDB or Redis connection on AWS).
- **AC-1.3** THE SYSTEM SHALL validate at startup the variables that the selected drivers need
  (for example `MONGODB_URI` only with `mongodb`, `S3_BUCKET` only with `s3`).
- **AC-1.4** With the default configuration, local behavior SHALL not change.

### US-2 — Files in S3

- **AC-2.1** THE `s3` storage SHALL save, read and delete objects in a private bucket.
- **AC-2.2** WHEN an object is missing on read, THE SYSTEM SHALL throw, as the local storage
  does, so the worker treats it like any other failed read.

### US-3 — Jobs in SQS

- **AC-3.1** THE `sqs` queue SHALL send one message per document with its id.
- **AC-3.2** WHEN SQS is unavailable on upload, THE API SHALL respond `503` and store nothing,
  as with BullMQ.
- **AC-3.3** THE worker Lambda SHALL process one message per invocation with
  `DocumentProcessingService`.
- **AC-3.4** WHEN processing fails with a transient error and attempts remain, THE worker SHALL
  return the message to the queue; on a permanent error or the last attempt
  (`PROCESSING_MAX_ATTEMPTS`), it SHALL mark the document `failed` and remove the message.
- **AC-3.5** Messages that still fail (for example, the worker crashed) SHALL end in a
  dead-letter queue after `PROCESSING_MAX_ATTEMPTS` receives.

### US-4 — Data in DynamoDB

- **AC-4.1** THE DynamoDB document repository SHALL support every `DocumentRepository`
  operation, including cursor pagination newest first and `search`.
- **AC-4.2** THE DynamoDB conversation repository SHALL support every `ConversationRepository`
  operation, with one item per message (NFR-7 of spec 005).
- **AC-4.3** THE tables SHALL use provisioned capacity within the always-free 25 read and 25
  write capacity units in total.

### US-5 — Status events on AWS

- **AC-5.1** WHEN the events driver is `none`, publishing SHALL do nothing and
  `GET /documents/events` SHALL respond `503`, so browsers stop the stream and the web client
  keeps polling.

### US-6 — Deployment

- **AC-6.1** `cdk deploy` SHALL create the bucket, queues, tables, both Lambda functions, the
  function URL and log groups, and print the API URL.
- **AC-6.2** THE API URL SHALL serve every endpoint, and question answers SHALL stream.
- **AC-6.3** THE upload limit on AWS SHALL be 5 MB (function URL requests are limited to 6 MB).
- **AC-6.4** `cdk destroy` SHALL remove everything except the bucket and the tables, which are
  kept to avoid losing data by accident (documented how to delete them).
- **AC-6.5** THE OpenAI key SHALL never be in the repository or in CDK output.

## Non-functional requirements

- **NFR-1** Cost: only services with always-free allowances or covered by the free plan
  credits; no VPC, NAT Gateway, RDS, ElastiCache or Fargate. A budget alert exists before the
  first deploy.
- **NFR-2** Every AWS implementation has unit tests with mocked AWS clients; no test needs an
  AWS account.
- **NFR-3** Least privilege: each Lambda gets only the permissions it uses.
- **NFR-4** Logs keep their structured format and are retained 7 days.
- **NFR-5** The worker logic stays independent of the queue technology (shared retry decision
  for BullMQ and SQS).

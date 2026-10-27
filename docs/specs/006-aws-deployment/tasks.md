# 006 — AWS deployment: tasks

Code (no AWS account needed):

- [x] **T1** Add the AWS SDK clients, `aws-sdk-client-mock` and `@types/aws-lambda`.
- [x] **T2** Env schema: new drivers and variables, conditional requirements + tests. (AC-1.3)
- [x] **T3** `importForDriver`; split database, persistence, queue, events and processing modules
      by driver with no local behavior change + tests. (AC-1.1, AC-1.2, AC-1.4)
- [x] **T4** `S3StorageProvider` + tests. (US-2)
- [x] **T5** `SqsQueueProvider` + tests. (AC-3.1, AC-3.2)
- [x] **T6** `DocumentJobRunner` shared with the BullMQ consumer; `sqs-worker.handler` + tests.
      (AC-3.3, AC-3.4, NFR-5)
- [x] **T7** DynamoDB document repository and mapper + tests. (AC-4.1)
- [x] **T8** DynamoDB conversation repository and mapper + tests. (AC-4.2)
- [x] **T9** `none` events driver + tests. (AC-5.1)
- [x] **T10** Lint, unit tests, e2e and build.

Infrastructure:

- [x] **T11** `infra/` CDK project: stack, packaging script, CDK assertion tests. (US-6, NFR-1,
      NFR-3, NFR-4)
- [x] **T12** `docs/aws-setup.md`: account, MFA, budget alert, CLI credentials, bootstrap,
      deploy, destroy. README section.
- [x] **T15** Web client on S3 + CloudFront in the same stack: OAC, SPA fallback, runtime
      `config.json` with the API URL, CORS from the CloudFront domain, CDK tests and guide.

Deployment (with the owner):

- [x] **T13** Account and budget alert (owner), `cdk bootstrap` and first deploy.
- [ ] **T14** Manual run on AWS: upload the sample documents, ask questions, check CloudWatch and
      billing.

## Verification log

- 2026-10-26 — Code (T1–T10): lint clean; 311 unit tests and 38 e2e tests pass; build OK. The
  AWS wiring test compiles the API and the Lambda worker with the AWS drivers and finds no
  MongoDB connection. The local API kept working with the default drivers.
- 2026-10-26 — Infrastructure (T11–T12): 10 CDK assertion tests pass; `cdk synth` produces the
  stack and uses the Lambda zip as-is.
- Lambda package checked in Linux containers before any deploy:
  - `run.sh` is stored with mode 755 and LF line endings.
  - Extracted from the zip inside a `node:24-alpine` container with the AWS variables, the API
    started (`GET /health` → 200, JSON logs) and `GET /documents/events` → 503; the worker
    handler module imports and exports `handler`.
  - Unzipped size 104 MB after pruning (243 MB before).
- 2026-10-26 — First deploy to a new free-plan account (`us-east-1`), as `docuia-admin` with
  `aws login`: `cdk bootstrap` and `cdk deploy` created the 21 resources in 93 s.
  - `GET /health` → 200 (5.9 s on the cold start, 0.4–0.6 s after), `GET /documents` → empty
    page from DynamoDB, `GET /documents/events` → 503.
  - The first upload stayed `pending`: the worker failed with `Cannot find module 'sqs-worker'`.
    Lambda reads the handler as `file.function` and splits at the first dot of the file name,
    so `dist/lambda/sqs-worker.handler.handler` could not load. Fixed with
    `src/lambda/index.ts` as the entry point and a CDK test for the handler format (the local
    smoke test imported the module directly, so it did not catch it).
  - After redeploying, SQS delivered the same message again when its visibility timeout ended
    and the document became `ready` with the right type, summary and total
    (TECNOSUMINISTROS DEL CARIBE S.A.S., 2.638.825 COP) without uploading it again.
  - `POST /documents/:id/ask` streamed through the function URL: `conversation` at 1.1 s,
    `status` and `tool` events in between, the verified answer at 6.7 s and `done` at 6.8 s.
- Implementation notes:
  - `ConditionalModule` decides when the module file is imported, so the AWS wiring test sets
    the variables before importing the root modules (Lambda sets them before the process
    starts).
  - Running the packaged app from a Windows folder mounted in Docker was too slow to start
    (thousands of small files over the shared mount); extracting the zip inside the container
    is representative of Lambda.
  - Git Bash rewrites Linux paths in `docker` arguments; `MSYS_NO_PATHCONV=1` avoids it for
    manual commands (the packaging script runs Docker from Node, so it is not affected).

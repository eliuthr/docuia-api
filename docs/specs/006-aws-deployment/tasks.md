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

- [ ] **T11** `infra/` CDK project: stack, packaging script, CDK assertion tests. (US-6, NFR-1,
      NFR-3, NFR-4)
- [ ] **T12** `docs/aws-setup.md`: account, MFA, budget alert, CLI credentials, bootstrap,
      deploy, destroy. README section.

Deployment (with the owner):

- [ ] **T13** Account and budget alert (owner), `cdk bootstrap` and first deploy.
- [ ] **T14** Manual run on AWS: upload the sample documents, ask questions, check CloudWatch and
      billing.

## Verification log

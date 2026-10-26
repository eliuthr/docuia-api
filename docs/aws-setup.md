# Deploying DocuIA to AWS

This guide takes a new AWS account to a working DocuIA API on Lambda. Everything it creates fits
in the AWS free tier; the only real cost is the OpenAI API. Read it once before starting.

What gets created (see `docs/specs/006-aws-deployment/design.md`):

- Two Lambda functions (API and worker), arm64, no VPC.
- A function URL for the API (HTTPS, response streaming).
- An S3 bucket, an SQS queue with a dead-letter queue, and three DynamoDB tables.
- Two CloudWatch log groups (7-day retention).

> **The API URL is public until authentication is added (spec 007).** Anyone who has it can
> upload documents and spend your OpenAI credit. Do not share it, set an OpenAI usage limit
> (step 4) and run `npm run destroy` when the demo is over.

## 1. Create the account

1. Sign up at <https://aws.amazon.com/free> and choose the **Free plan** (credits, no charges
   while it lasts).
2. Sign in as the root user and enable **MFA** for it (IAM → Security credentials →
   Multi-factor authentication). Use the root user only for account-level tasks.
3. Do **not** enable AWS Organizations or IAM Identity Center: they can move the account to the
   paid plan.
4. In the console, select the region **US East (N. Virginia) `us-east-1`** (top right). DocuIA
   deploys there by default.

## 2. Budget alerts (before creating anything else)

1. Billing and Cost Management → **Budgets** → **Create budget** → **Use a template** →
   **Zero spend budget**. Enter your email. It alerts as soon as anything costs money.
2. Create a second budget from the **Monthly cost budget** template with an amount of **5 USD**,
   to get an alert at 80 % of a small, fixed limit.

## 3. A user for daily work

1. IAM → Users → **Create user** `docuia-admin`, with console access.
2. Attach the policies **AdministratorAccess** (CDK needs to create roles and resources) and
   **SignInLocalDevelopmentAccess** (lets the CLI use your console sign-in).
3. Sign out, sign in as `docuia-admin` and enable MFA for it.

## 4. OpenAI usage limit

In the OpenAI dashboard, set a monthly budget (for example 5 USD) for the project whose key
DocuIA uses.

## 5. Tools on your machine

- **AWS CLI v2.32 or newer**: <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>.
  Check with `aws --version`.
- **Docker Desktop** running (the Lambda package is zipped inside a Linux container).
- Node.js 24 (already used by the project).

Sign in from the CLI with your console user; no access keys are created or stored:

```powershell
aws login            # opens the browser; credentials last up to 12 hours
aws sts get-caller-identity   # must show the docuia-admin user
```

## 6. Bootstrap CDK (once per account and region)

`cdk bootstrap` creates a small `CDKToolkit` stack (an S3 bucket and IAM roles) that CDK uses to
upload the Lambda package.

```powershell
cd infra
npm ci
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

`<ACCOUNT_ID>` is the `Account` value printed by `aws sts get-caller-identity`.

## 7. Deploy

The OpenAI key is read from your shell, never from the repository. This reads it from the
API's local `.env` without typing it (so it is not saved in the PowerShell history):

```powershell
cd infra
$env:OPENAI_API_KEY = ((Get-Content ..\.env | Select-String '^OPENAI_API_KEY=').Line -split '=', 2)[1]
# Optional: the web client's origin, if it is not http://localhost:4200
# $env:DOCUIA_CORS_ORIGIN = 'https://your-web-client'
npm run deploy
```

`npm run deploy` builds the API, packages it (`scripts/package-lambda.mjs`), compiles the stack
and runs `cdk deploy`. CDK shows the IAM changes and asks for confirmation. At the end it prints
the outputs:

- `ApiUrl`: the public URL of the API.
- `ApiLogGroup` and `WorkerLogGroup`: CloudWatch log groups.
- `DeadLetterQueueUrl`: messages that failed every attempt.

## 8. Check it

```powershell
$api = '<ApiUrl without the trailing slash>'
curl.exe "$api/health"
curl.exe -F "file=@..\..\docs\documentos-prueba\1-factura-electronica.pdf" "$api/documents"
curl.exe "$api/documents?limit=5"
aws logs tail <WorkerLogGroup> --follow
```

To use the web client against AWS, set `apiBaseUrl` in `docuia-web/src/environments` to the
`ApiUrl`. Live status events are off on AWS (`GET /documents/events` responds `503`), so the
web client polls instead.

Check the cost: Billing and Cost Management → **Free tier** shows the usage of each service.

## 9. Update or remove

- Deploy again after changes: `npm run deploy`.
- Remove everything: `npm run destroy`. The S3 bucket and the DynamoDB tables are **kept**
  on purpose, so data is never lost by accident. Delete them when you no longer need them:

  ```powershell
  aws s3 rm s3://<bucket-name> --recursive
  aws s3 rb s3://<bucket-name>
  aws dynamodb delete-table --table-name <table-name>   # once per table
  ```

  The names are in CloudFormation → `DocuiaStack` → Resources (before destroying) or in the S3
  and DynamoDB consoles.

- The `CDKToolkit` stack can stay; delete it from CloudFormation only if you stop using CDK in
  this account.

## Troubleshooting

| Symptom                                          | Cause and fix                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `Lambda package not found`                       | Run `npm run package:lambda` (or `npm run deploy`, which runs it).                 |
| `OPENAI_API_KEY is not set`                      | Set it in the same shell (step 7) before `cdk` commands.                           |
| `docker: ... cannot connect`                     | Start Docker Desktop.                                                              |
| `The Lambda package is ... MB`                   | A dependency grew; check `npm ls --omit=dev` for packages that should be dev-only. |
| `ExpiredToken` or `Unable to locate credentials` | Run `aws login` again (sessions last up to 12 hours).                              |
| Upload responds `413`                            | Files are limited to 5 MB on AWS (function URL request limit).                     |

#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { Code } from 'aws-cdk-lib/aws-lambda';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DocuiaStack } from '../lib/docuia-stack';
import lambdaPackage from '../lambda-package.json';

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_CORS_ORIGIN = 'http://localhost:4200';

/** Lee una variable obligatoria del shell con un mensaje que dice cómo resolverla. */
function requireVariable(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`);
  }
  return value;
}

// El JS compilado queda en dist/bin, así que `infra/` está dos niveles arriba.
const lambdaZip = resolve(
  __dirname,
  '..',
  '..',
  lambdaPackage.buildDir,
  lambdaPackage.zipFile,
);
if (!existsSync(lambdaZip)) {
  throw new Error(
    `Lambda package not found at ${lambdaZip}. Run "npm run package:lambda" first.`,
  );
}

const app = new App();
new DocuiaStack(app, 'DocuiaStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? DEFAULT_REGION,
  },
  description: 'DocuIA: document processing API with an LLM (free tier)',
  lambdaCode: Code.fromAsset(lambdaZip),
  openAiApiKey: requireVariable(
    'OPENAI_API_KEY',
    'Set it in this shell before running CDK; it is never stored in the repository.',
  ),
  corsOrigin: process.env.DOCUIA_CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN,
});

#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { Code } from 'aws-cdk-lib/aws-lambda';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DocuiaStack } from '../lib/docuia-stack';
import lambdaPackage from '../lambda-package.json';
import webApp from '../web-app.json';

const DEFAULT_REGION = 'us-east-1';

/** Lee una variable obligatoria del shell con un mensaje que dice cómo resolverla. */
function requireVariable(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`);
  }
  return value;
}

/** Falla antes de sintetizar si falta un artefacto que se genera con un script. */
function requireBuildOutput(
  path: string,
  label: string,
  script: string,
): string {
  if (!existsSync(path)) {
    throw new Error(
      `${label} not found at ${path}. Run "npm run ${script}" first.`,
    );
  }
  return path;
}

// El JS compilado queda en dist/bin, así que `infra/` está dos niveles arriba.
const infraDir = resolve(__dirname, '..', '..');
const lambdaZip = requireBuildOutput(
  resolve(infraDir, lambdaPackage.buildDir, lambdaPackage.zipFile),
  'Lambda package',
  'package:lambda',
);
const webBuild = requireBuildOutput(
  resolve(infraDir, webApp.webDir, webApp.buildDir),
  'Web client build',
  'package:web',
);

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
  webAssets: Source.asset(webBuild),
});

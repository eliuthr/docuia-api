import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { createAppLogger } from '../common/logging/create-app-logger.js';
import { SqsDocumentConsumer } from '../processing/sqs-document.consumer.js';
import { LambdaWorkerModule } from './lambda-worker.module.js';
import { processSqsEvent } from './process-sqs-event.js';

/**
 * La app de Nest se crea una vez por entorno de ejecución y se reutiliza
 * mientras la Lambda siga "caliente"; si el arranque falla, se reintenta en la
 * siguiente invocación.
 */
let appContext: Promise<INestApplicationContext> | undefined;

function getAppContext(): Promise<INestApplicationContext> {
  appContext ??= NestFactory.createApplicationContext(LambdaWorkerModule, {
    logger: createAppLogger(),
  }).catch((error: unknown) => {
    appContext = undefined;
    throw error;
  });
  return appContext;
}

/** Punto de entrada de la Lambda del worker, invocada por la cola SQS. */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const app = await getAppContext();
  return processSqsEvent(app.get(SqsDocumentConsumer), event);
}

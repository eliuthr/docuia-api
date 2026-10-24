import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // Deja terminar los trabajos en curso y cierra Redis y MongoDB al recibir SIGTERM/SIGINT.
  app.enableShutdownHooks();
  Logger.log({ event: 'worker.started' }, 'Bootstrap');
}
await bootstrap();

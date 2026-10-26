import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { createAppLogger } from './common/logging/create-app-logger.js';
import { Env } from './config/env.schema.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: createAppLogger(),
  });
  configureApp(app);

  const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', {
    infer: true,
  });
  await app.listen(port);
  Logger.log({ event: 'server.started', port }, 'Bootstrap');
}
await bootstrap();

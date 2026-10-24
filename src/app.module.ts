import { Module } from '@nestjs/common';
import { QuestionsModule } from './ai/questions/questions.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    DocumentsModule,
    QuestionsModule,
  ],
})
export class AppModule {}

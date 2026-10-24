import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { provideByDriver } from '../../common/providers/provide-by-driver.js';
import { Env } from '../../config/env.schema.js';
import { LlmProvider } from './llm.provider.js';
import { OpenAiLlmProvider } from './openai-llm.provider.js';

@Module({
  providers: [
    {
      provide: OpenAI,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new OpenAI({
          apiKey: config.get('OPENAI_API_KEY', { infer: true }),
          timeout: config.get('LLM_TIMEOUT_MS', { infer: true }),
          // Los reintentos los maneja la cola (BullMQ), no el SDK.
          maxRetries: 0,
        }),
    },
    provideByDriver(LlmProvider, 'LLM_DRIVER', { openai: OpenAiLlmProvider }),
  ],
  exports: [LlmProvider],
})
export class LlmModule {}

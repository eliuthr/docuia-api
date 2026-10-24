import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AiModule } from './ai.module.js';
import { DocumentAnalyzerService } from './extraction/document-analyzer.service.js';
import { LlmProvider } from './llm/llm.provider.js';
import { OpenAiLlmProvider } from './llm/openai-llm.provider.js';

describe('AiModule', () => {
  it('wires the analyzer with the OpenAI provider for the openai driver', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              LLM_DRIVER: 'openai',
              OPENAI_API_KEY: 'sk-test',
              OPENAI_MODEL: 'gpt-6-luna',
              LLM_TIMEOUT_MS: 1000,
              LLM_MAX_INPUT_CHARS: 1000,
            }),
          ],
        }),
        AiModule,
      ],
    }).compile();

    expect(moduleRef.get(DocumentAnalyzerService)).toBeInstanceOf(
      DocumentAnalyzerService,
    );
    expect(moduleRef.get(LlmProvider, { strict: false })).toBeInstanceOf(
      OpenAiLlmProvider,
    );
  });
});

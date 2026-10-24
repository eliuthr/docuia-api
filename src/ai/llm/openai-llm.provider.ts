import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { RateLimitError } from 'openai';
import type {
  Response,
  ResponseInput,
} from 'openai/resources/responses/responses';
import { Env } from '../../config/env.schema.js';
import { LlmQuotaExceededError } from '../errors/llm-quota-exceeded.error.js';
import { LlmInput, LlmProvider, StructuredRequest } from './llm.provider.js';

const QUOTA_EXCEEDED_CODE = 'insufficient_quota';

/** Implementación de LlmProvider con la Responses API de OpenAI y salida estructurada. */
@Injectable()
export class OpenAiLlmProvider extends LlmProvider {
  private readonly logger = new Logger(OpenAiLlmProvider.name);
  private readonly model: string;

  constructor(
    private readonly client: OpenAI,
    config: ConfigService<Env, true>,
  ) {
    super();
    this.model = config.get('OPENAI_MODEL', { infer: true });
  }

  async generateJson(request: StructuredRequest): Promise<string> {
    const response = await this.createResponse(request);
    this.logger.log({
      event: 'llm.response',
      documentId: request.documentId,
      schemaName: request.schemaName,
      model: this.model,
      status: response.status,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });
    return response.output_text;
  }

  private async createResponse(request: StructuredRequest): Promise<Response> {
    try {
      return await this.client.responses.create({
        model: this.model,
        instructions: request.instructions,
        input: toResponseInput(request.input),
        max_output_tokens: request.maxOutputTokens,
        // No guardar las respuestas en OpenAI: los documentos pueden tener datos personales.
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: request.schemaName,
            schema: request.jsonSchema,
            strict: true,
          },
        },
      });
    } catch (error) {
      throw isQuotaExceeded(error) ? new LlmQuotaExceededError() : error;
    }
  }
}

function toResponseInput(input: LlmInput): string | ResponseInput {
  if (input.kind === 'text') {
    return input.text;
  }
  const base64 = input.content.toString('base64');
  return [
    {
      role: 'user',
      content: [
        {
          type: 'input_image',
          image_url: `data:${input.mimeType};base64,${base64}`,
          detail: 'auto',
        },
      ],
    },
  ];
}

/** Un 429 puede ser rate limit (transitorio) o falta de saldo (permanente); los distingue el código. */
function isQuotaExceeded(error: unknown): boolean {
  return error instanceof RateLimitError && error.code === QUOTA_EXCEEDED_CODE;
}

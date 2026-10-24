import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { RateLimitError } from 'openai';
import type {
  Response,
  ResponseInput,
  ResponseStreamEvent,
} from 'openai/resources/responses/responses';
import { Env } from '../../config/env.schema.js';
import { LlmQuotaExceededError } from '../errors/llm-quota-exceeded.error.js';
import { TurnEvent, TurnRequest } from './conversation.js';
import { LlmInput, LlmProvider, StructuredRequest } from './llm.provider.js';
import {
  toConversationItems,
  toOpenAiInput,
  toOpenAiTools,
} from './openai-conversation.mapper.js';

const QUOTA_EXCEEDED_CODE = 'insufficient_quota';

/** Implementación de LlmProvider con la Responses API de OpenAI. */
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
    const response = await withQuotaMapping(() =>
      this.client.responses.create({
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
      }),
    );
    this.logResponse(
      { documentId: request.documentId, schemaName: request.schemaName },
      response,
    );
    return response.output_text;
  }

  async *streamTurn(request: TurnRequest): AsyncIterable<TurnEvent> {
    const stream = await withQuotaMapping(() =>
      this.client.responses.create(
        {
          model: this.model,
          instructions: request.instructions,
          input: toOpenAiInput(request.items),
          tools: toOpenAiTools(request.tools),
          max_output_tokens: request.maxOutputTokens,
          store: false,
          stream: true,
        },
        { signal: request.signal },
      ),
    );

    for await (const event of stream) {
      yield* this.toTurnEvents(request, event);
    }
  }

  private *toTurnEvents(
    request: TurnRequest,
    event: ResponseStreamEvent,
  ): Generator<TurnEvent> {
    if (event.type === 'response.output_text.delta') {
      yield { type: 'text_delta', text: event.delta };
      return;
    }
    // `incomplete` llega cuando se alcanzó max_output_tokens; su salida parcial se usa igual.
    if (
      event.type === 'response.completed' ||
      event.type === 'response.incomplete'
    ) {
      yield this.completeTurn(request, event.response);
      return;
    }
    if (event.type === 'response.failed' || event.type === 'error') {
      throw new Error(`OpenAI stream failed: ${event.type}`);
    }
  }

  private completeTurn(request: TurnRequest, response: Response): TurnEvent {
    this.logResponse(request.logContext, response);
    return {
      type: 'turn_completed',
      items: toConversationItems(response.output),
    };
  }

  private logResponse(context: Record<string, string>, response: Response) {
    this.logger.log({
      event: 'llm.response',
      ...context,
      model: this.model,
      status: response.status,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });
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
async function withQuotaMapping<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const isQuotaExceeded =
      error instanceof RateLimitError && error.code === QUOTA_EXCEEDED_CODE;
    throw isQuotaExceeded ? new LlmQuotaExceededError() : error;
  }
}

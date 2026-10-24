import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { RateLimitError } from 'openai';
import { Env } from '../../config/env.schema.js';
import { LlmQuotaExceededError } from '../errors/llm-quota-exceeded.error.js';
import { TurnEvent, TurnRequest } from './conversation.js';
import { StructuredRequest } from './llm.provider.js';
import { OpenAiLlmProvider } from './openai-llm.provider.js';

const MODEL = 'gpt-6-luna';
const JSON_SCHEMA = { type: 'object', properties: {} };

function buildRequest(
  overrides: Partial<StructuredRequest> = {},
): StructuredRequest {
  return {
    documentId: 'doc-1',
    instructions: 'Extract the invoice.',
    input: { kind: 'text', text: 'Total 150' },
    schemaName: 'invoice',
    jsonSchema: JSON_SCHEMA,
    maxOutputTokens: 1000,
    ...overrides,
  };
}

function rateLimitError(code: string): RateLimitError {
  return new RateLimitError(429, { code }, 'Rate limited', new Headers());
}

describe('OpenAiLlmProvider', () => {
  let create: ReturnType<typeof vi.fn>;
  let provider: OpenAiLlmProvider;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    create = vi.fn().mockResolvedValue({
      status: 'completed',
      output_text: '{"total":150}',
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const client = { responses: { create } } as unknown as OpenAI;
    const config = {
      get: vi.fn().mockReturnValue(MODEL),
    } as unknown as ConfigService<Env, true>;
    provider = new OpenAiLlmProvider(client, config);
  });

  it('returns the raw text produced by the model', async () => {
    await expect(provider.generateJson(buildRequest())).resolves.toBe(
      '{"total":150}',
    );
  });

  it('requests strict structured output without storing the response', async () => {
    await provider.generateJson(buildRequest());

    expect(create).toHaveBeenCalledWith({
      model: MODEL,
      instructions: 'Extract the invoice.',
      input: 'Total 150',
      max_output_tokens: 1000,
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'invoice',
          schema: JSON_SCHEMA,
          strict: true,
        },
      },
    });
  });

  it('sends images as base64 data URLs', async () => {
    const content = Buffer.from('fake-png');

    await provider.generateJson(
      buildRequest({
        input: { kind: 'image', mimeType: 'image/png', content },
      }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: `data:image/png;base64,${content.toString('base64')}`,
                detail: 'auto',
              },
            ],
          },
        ],
      }),
    );
  });

  it('maps an exhausted quota to LlmQuotaExceededError', async () => {
    create.mockRejectedValue(rateLimitError('insufficient_quota'));

    await expect(provider.generateJson(buildRequest())).rejects.toBeInstanceOf(
      LlmQuotaExceededError,
    );
  });

  it('propagates a regular rate limit unchanged so the queue retries it', async () => {
    const failure = rateLimitError('rate_limit_exceeded');
    create.mockRejectedValue(failure);

    await expect(provider.generateJson(buildRequest())).rejects.toBe(failure);
  });

  describe('streamTurn', () => {
    const completedResponse = {
      status: 'completed',
      usage: { input_tokens: 20, output_tokens: 8 },
      output: [
        {
          type: 'function_call',
          call_id: 'call-1',
          name: 'find_documents',
          arguments: '{}',
        },
      ],
    };

    function buildTurnRequest(): TurnRequest {
      return {
        logContext: { endpoint: 'ask' },
        instructions: 'Answer the question.',
        items: [{ kind: 'user_message', text: '¿Cuánto suman?' }],
        tools: [
          { name: 'find_documents', description: 'Find', parameters: {} },
        ],
        maxOutputTokens: 500,
        signal: new AbortController().signal,
      };
    }

    async function* streamOf(events: unknown[]): AsyncGenerator<unknown> {
      for (const event of events) {
        yield await Promise.resolve(event);
      }
    }

    async function collect(
      events: AsyncIterable<TurnEvent>,
    ): Promise<TurnEvent[]> {
      const collected: TurnEvent[] = [];
      for await (const event of events) {
        collected.push(event);
      }
      return collected;
    }

    it('streams text deltas and ends with the completed items', async () => {
      create.mockResolvedValue(
        streamOf([
          { type: 'response.output_text.delta', delta: 'Hola' },
          { type: 'response.in_progress' },
          { type: 'response.completed', response: completedResponse },
        ]),
      );

      await expect(
        collect(provider.streamTurn(buildTurnRequest())),
      ).resolves.toEqual([
        { type: 'text_delta', text: 'Hola' },
        {
          type: 'turn_completed',
          items: [
            {
              kind: 'tool_call',
              callId: 'call-1',
              toolName: 'find_documents',
              arguments: '{}',
            },
          ],
        },
      ]);
    });

    it('requests a stream with strict tools and the abort signal', async () => {
      create.mockResolvedValue(streamOf([]));
      const request = buildTurnRequest();

      await collect(provider.streamTurn(request));

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: MODEL,
          stream: true,
          store: false,
          input: [{ role: 'user', content: '¿Cuánto suman?' }],
          tools: [expect.objectContaining({ strict: true })],
        }),
        { signal: request.signal },
      );
    });

    it('uses the partial output of an incomplete response', async () => {
      create.mockResolvedValue(
        streamOf([
          { type: 'response.incomplete', response: completedResponse },
        ]),
      );

      const events = await collect(provider.streamTurn(buildTurnRequest()));

      expect(events).toEqual([
        expect.objectContaining({ type: 'turn_completed' }),
      ]);
    });

    it('throws when the stream reports a failure', async () => {
      create.mockResolvedValue(streamOf([{ type: 'response.failed' }]));

      await expect(
        collect(provider.streamTurn(buildTurnRequest())),
      ).rejects.toThrow(/stream failed/);
    });

    it('maps an exhausted quota to LlmQuotaExceededError', async () => {
      create.mockRejectedValue(rateLimitError('insufficient_quota'));

      await expect(
        collect(provider.streamTurn(buildTurnRequest())),
      ).rejects.toBeInstanceOf(LlmQuotaExceededError);
    });
  });
});

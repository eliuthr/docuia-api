import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { RateLimitError } from 'openai';
import { Env } from '../../config/env.schema.js';
import { LlmQuotaExceededError } from '../errors/llm-quota-exceeded.error.js';
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
});

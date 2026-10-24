import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { InvalidLlmResponseError } from '../errors/invalid-llm-response.error.js';
import { LlmProvider } from '../llm/llm.provider.js';
import {
  StructuredOutputRequest,
  StructuredOutputService,
} from './structured-output.service.js';

const totalSchema = z.object({ total: z.number() });

const request: StructuredOutputRequest<z.infer<typeof totalSchema>> = {
  documentId: 'doc-1',
  instructions: 'Extract the total.',
  input: { kind: 'text', text: 'Total 150' },
  schemaName: 'total',
  schema: totalSchema,
  maxOutputTokens: 100,
};

describe('StructuredOutputService', () => {
  let generateJson: ReturnType<typeof vi.fn>;
  let service: StructuredOutputService;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    generateJson = vi.fn().mockResolvedValue('{"total":150}');
    service = new StructuredOutputService({
      generateJson,
    } as unknown as LlmProvider);
  });

  it('returns the validated output', async () => {
    await expect(service.generate(request)).resolves.toEqual({ total: 150 });
    expect(generateJson).toHaveBeenCalledTimes(1);
  });

  it('sends the schema as JSON Schema without the $schema key', async () => {
    await service.generate(request);

    expect(generateJson).toHaveBeenCalledWith({
      documentId: 'doc-1',
      instructions: 'Extract the total.',
      input: { kind: 'text', text: 'Total 150' },
      schemaName: 'total',
      maxOutputTokens: 100,
      jsonSchema: {
        type: 'object',
        properties: { total: { type: 'number' } },
        required: ['total'],
        additionalProperties: false,
      },
    });
  });

  it('retries once when the output does not match the schema', async () => {
    generateJson
      .mockResolvedValueOnce('{"total":"ciento cincuenta"}')
      .mockResolvedValueOnce('{"total":150}');

    await expect(service.generate(request)).resolves.toEqual({ total: 150 });
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it('treats output that is not JSON as invalid', async () => {
    generateJson
      .mockResolvedValueOnce('{"total": 15')
      .mockResolvedValueOnce('{"total":150}');

    await expect(service.generate(request)).resolves.toEqual({ total: 150 });
  });

  it('throws InvalidLlmResponseError when the retry is also invalid', async () => {
    generateJson.mockResolvedValue('{}');

    await expect(service.generate(request)).rejects.toBeInstanceOf(
      InvalidLlmResponseError,
    );
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it('does not retry provider errors; the queue handles them', async () => {
    const failure = new Error('timeout');
    generateJson.mockRejectedValue(failure);

    await expect(service.generate(request)).rejects.toBe(failure);
    expect(generateJson).toHaveBeenCalledTimes(1);
  });
});

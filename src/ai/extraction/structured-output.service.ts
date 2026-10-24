import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { InvalidLlmResponseError } from '../errors/invalid-llm-response.error.js';
import {
  JsonSchema,
  LlmProvider,
  StructuredRequest,
} from '../llm/llm.provider.js';

/** El primer intento más un reintento, como piden las reglas del proyecto. */
const MAX_VALIDATION_ATTEMPTS = 2;

export interface StructuredOutputRequest<T> extends Omit<
  StructuredRequest,
  'jsonSchema'
> {
  schema: z.ZodType<T>;
}

/** Pide al LLM una respuesta con forma de esquema y la valida con Zod antes de devolverla. */
@Injectable()
export class StructuredOutputService {
  private readonly logger = new Logger(StructuredOutputService.name);

  constructor(private readonly llm: LlmProvider) {}

  async generate<T>(request: StructuredOutputRequest<T>): Promise<T> {
    const { schema, ...fields } = request;
    const llmRequest = { ...fields, jsonSchema: toJsonSchema(schema) };

    for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
      const rawOutput = await this.llm.generateJson(llmRequest);
      const result = schema.safeParse(parseJson(rawOutput));
      if (result.success) {
        return result.data;
      }
      this.logger.warn({
        event: 'llm.response.invalid',
        documentId: request.documentId,
        schemaName: request.schemaName,
        attempt,
      });
    }
    throw new InvalidLlmResponseError(request.schemaName);
  }
}

/** El modo strict no necesita la clave `$schema`, así que se quita. */
function toJsonSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(schema);
  return jsonSchema;
}

/** Devuelve undefined si el texto no es JSON, para que la validación de Zod lo rechace. */
function parseJson(rawOutput: string): unknown {
  try {
    return JSON.parse(rawOutput);
  } catch {
    return undefined;
  }
}

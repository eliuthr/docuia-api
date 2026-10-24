import { z } from 'zod';
import { JsonSchema } from './json-schema.js';

/** Convierte un esquema de Zod al JSON Schema que reciben los proveedores (sin la clave `$schema`). */
export function toJsonSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(schema);
  return jsonSchema;
}

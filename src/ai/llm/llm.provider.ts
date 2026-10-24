import { TurnEvent, TurnRequest } from './conversation.js';
import { JsonSchema } from './json-schema.js';

export type { JsonSchema };

/** Contenido que se le envía al modelo: texto plano o una imagen (visión). */
export type LlmInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; mimeType: string; content: Buffer };

export interface StructuredRequest {
  /** Id del documento; solo se usa en los logs. */
  documentId: string;
  /** Prompt de sistema, tomado de `src/ai/prompts`. */
  instructions: string;
  input: LlmInput;
  /** Nombre corto del esquema, por ejemplo `invoice`. */
  schemaName: string;
  jsonSchema: JsonSchema;
  maxOutputTokens: number;
}

/**
 * Puerto hacia un modelo de lenguaje. Es una clase abstracta y no una interfaz
 * para que Nest pueda usarla como token de inyección.
 */
export abstract class LlmProvider {
  /**
   * Devuelve el texto crudo que produjo el modelo, que debería ser JSON con la
   * forma de `jsonSchema`. No es confiable: quien llama lo valida con Zod.
   */
  abstract generateJson(request: StructuredRequest): Promise<string>;

  /**
   * Hace una vuelta de conversación con herramientas: emite el texto a medida
   * que llega y termina con `turn_completed`. No ejecuta herramientas; eso lo
   * hace quien llama.
   */
  abstract streamTurn(request: TurnRequest): AsyncIterable<TurnEvent>;
}

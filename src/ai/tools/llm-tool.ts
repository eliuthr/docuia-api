import { z } from 'zod';

/**
 * Herramienta que el modelo puede pedir que ejecutemos. La descripción la lee
 * el modelo para decidir cuándo usarla, así que debe ser clara y concreta.
 */
export interface LlmTool<TInput = unknown> {
  readonly name: string;
  readonly description: string;
  /** Valida los argumentos que manda el modelo; también define el JSON Schema que ve. */
  readonly inputSchema: z.ZodType<TInput>;
  /** El resultado se serializa a JSON y se le devuelve al modelo. */
  execute(input: TInput): Promise<unknown>;
}

/** Token de inyección con la lista de herramientas disponibles. */
export const LLM_TOOLS = Symbol('LLM_TOOLS');

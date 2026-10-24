import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ToolDefinition } from '../llm/conversation.js';
import { parseJson } from '../../common/json/parse-json.js';
import { toJsonSchema } from '../llm/to-json-schema.js';
import { LLM_TOOLS, LlmTool } from './llm-tool.js';

/** Tope del resultado que se le devuelve al modelo, para acotar los tokens de entrada. */
export const MAX_TOOL_OUTPUT_CHARS = 8000;
const TRUNCATION_MARKER = '…[truncated]';

/** Expone las herramientas al modelo y ejecuta las que pide, validando sus argumentos. */
@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly toolsByName: ReadonlyMap<string, LlmTool>;

  constructor(@Inject(LLM_TOOLS) tools: LlmTool[]) {
    this.toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  }

  definitions(): ToolDefinition[] {
    return [...this.toolsByName.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: toJsonSchema(tool.inputSchema),
    }));
  }

  /**
   * Ejecuta una herramienta y devuelve su resultado como JSON. Los errores
   * (herramienta desconocida, argumentos inválidos, fallas) también se devuelven
   * como resultado, para que el modelo pueda corregirse en vez de romper la respuesta.
   */
  async execute(toolName: string, rawArguments: string): Promise<string> {
    const tool = this.toolsByName.get(toolName);
    if (!tool) {
      return serialize({ error: `Unknown tool "${toolName}".` });
    }
    const parsed = tool.inputSchema.safeParse(parseJson(rawArguments));
    if (!parsed.success) {
      const details = z.prettifyError(parsed.error);
      return serialize({ error: `Invalid arguments: ${details}` });
    }
    return serialize(await this.run(tool, parsed.data));
  }

  private async run(tool: LlmTool, input: unknown): Promise<unknown> {
    try {
      return await tool.execute(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({
        event: 'tool.failed',
        tool: tool.name,
        error: message,
      });
      return { error: 'The tool failed. Try again or answer without it.' };
    }
  }
}

function serialize(result: unknown): string {
  const json = JSON.stringify(result);
  if (json.length <= MAX_TOOL_OUTPUT_CHARS) {
    return json;
  }
  const keptChars = MAX_TOOL_OUTPUT_CHARS - TRUNCATION_MARKER.length;
  return json.slice(0, keptChars) + TRUNCATION_MARKER;
}

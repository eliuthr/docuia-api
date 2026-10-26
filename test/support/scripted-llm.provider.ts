import { TurnEvent, TurnRequest } from '../../src/ai/llm/conversation.js';
import {
  LlmProvider,
  StructuredRequest,
} from '../../src/ai/llm/llm.provider.js';

/** Turno del guion: los eventos que emite el modelo falso, o un error que lanza. */
export type ScriptedTurn = TurnEvent[] | Error;

/**
 * LLM falso para los tests e2e: responde siguiendo un guion de vueltas y de
 * respuestas estructuradas (por nombre de esquema), y guarda las peticiones
 * que recibió. Ningún test llama a una API de pago.
 */
export class ScriptedLlmProvider extends LlmProvider {
  readonly requests: TurnRequest[] = [];
  private turns: ScriptedTurn[] = [];
  private structuredOutputs = new Map<string, object[]>();

  /** Reinicia el guion completo; las respuestas estructuradas se agregan después. */
  script(...turns: ScriptedTurn[]): void {
    this.turns = turns;
    this.requests.length = 0;
    this.structuredOutputs.clear();
  }

  scriptStructured(schemaName: string, ...outputs: object[]): void {
    this.structuredOutputs.set(schemaName, outputs);
  }

  generateJson(request: StructuredRequest): Promise<string> {
    const output = this.structuredOutputs.get(request.schemaName)?.shift();
    if (!output) {
      return Promise.reject(
        new Error(`No scripted output for "${request.schemaName}".`),
      );
    }
    return Promise.resolve(JSON.stringify(output));
  }

  async *streamTurn(request: TurnRequest): AsyncIterable<TurnEvent> {
    this.requests.push(request);
    const turn = this.turns.shift() ?? [];
    if (turn instanceof Error) {
      throw turn;
    }
    for (const event of turn) {
      yield await Promise.resolve(event);
    }
  }
}

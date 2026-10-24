import { TurnEvent, TurnRequest } from '../../src/ai/llm/conversation.js';
import { LlmProvider } from '../../src/ai/llm/llm.provider.js';

/** Turno del guion: los eventos que emite el modelo falso, o un error que lanza. */
export type ScriptedTurn = TurnEvent[] | Error;

/**
 * LLM falso para los tests e2e: responde siguiendo un guion de vueltas y guarda
 * las peticiones que recibió. Ningún test llama a una API de pago.
 */
export class ScriptedLlmProvider extends LlmProvider {
  readonly requests: TurnRequest[] = [];
  private turns: ScriptedTurn[] = [];

  script(...turns: ScriptedTurn[]): void {
    this.turns = turns;
    this.requests.length = 0;
  }

  generateJson(): Promise<string> {
    return Promise.reject(new Error('The API process does not extract data.'));
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

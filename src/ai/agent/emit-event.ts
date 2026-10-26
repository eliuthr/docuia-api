import { AnswerEvent } from '../questions/answer-event.js';
import { AgentRuntime } from './agent-state.js';

/** Envía un evento al stream `custom` del grafo; QuestionAgentService lo reenvía al cliente. */
export function emitEvent(runtime: AgentRuntime, event: AnswerEvent): void {
  runtime.writer?.(event);
}

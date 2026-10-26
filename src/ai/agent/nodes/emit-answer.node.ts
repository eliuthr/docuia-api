import { Injectable } from '@nestjs/common';
import {
  AgentRuntime,
  AgentStateUpdate,
  AgentStateValues,
} from '../agent-state.js';
import { emitEvent } from '../emit-event.js';

/** Envía al cliente el borrador aceptado (o el último, si se acabaron las vueltas). */
@Injectable()
export class EmitAnswerNode {
  run(state: AgentStateValues, runtime: AgentRuntime): AgentStateUpdate {
    if (state.draft) {
      emitEvent(runtime, { type: 'delta', text: state.draft });
    }
    return {};
  }
}

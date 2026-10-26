import { Injectable } from '@nestjs/common';
import { buildRevisionRequest } from '../../prompts/revise-answer.prompt.js';
import {
  AgentRuntime,
  AgentStateUpdate,
  AgentStateValues,
} from '../agent-state.js';
import { emitEvent } from '../emit-event.js';

/** Le pasa al modelo lo que encontró el verificador para que corrija la respuesta. */
@Injectable()
export class ReviseAnswerNode {
  run(state: AgentStateValues, runtime: AgentRuntime): AgentStateUpdate {
    emitEvent(runtime, { type: 'status', step: 'revising' });
    return {
      items: [
        {
          kind: 'user_message',
          text: buildRevisionRequest(state.verdict?.feedback ?? ''),
        },
      ],
      revisions: state.revisions + 1,
      verdict: null,
    };
  }
}

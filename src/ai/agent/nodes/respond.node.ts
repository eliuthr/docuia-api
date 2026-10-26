import { Injectable } from '@nestjs/common';
import { LlmProvider } from '../../llm/llm.provider.js';
import { ANSWER_CONVERSATIONAL_PROMPT } from '../../prompts/answer-conversational.prompt.js';
import {
  AgentRuntime,
  AgentStateUpdate,
  AgentStateValues,
  getAgentContext,
} from '../agent-state.js';
import { emitEvent } from '../emit-event.js';
import { collectTurn } from '../model-turn.js';
import { ANSWER_MAX_OUTPUT_TOKENS } from './call-model.node.js';

/**
 * Responde mensajes que no necesitan datos (saludos, agradecimientos): una
 * vuelta sin herramientas ni verificación, transmitida a medida que se escribe.
 */
@Injectable()
export class RespondNode {
  constructor(private readonly llm: LlmProvider) {}

  async run(
    state: AgentStateValues,
    runtime: AgentRuntime,
  ): Promise<AgentStateUpdate> {
    emitEvent(runtime, { type: 'status', step: 'answering' });
    const { logContext, signal } = getAgentContext(runtime);
    const collected = await collectTurn(
      this.llm.streamTurn({
        logContext,
        instructions: ANSWER_CONVERSATIONAL_PROMPT,
        items: state.items,
        tools: [],
        maxOutputTokens: ANSWER_MAX_OUTPUT_TOKENS,
        signal,
      }),
      (text) => emitEvent(runtime, { type: 'delta', text }),
    );
    return { items: collected.items, draft: collected.text, turns: 1 };
  }
}

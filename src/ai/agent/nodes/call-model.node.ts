import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../../config/env.schema.js';
import { ToolDefinition } from '../../llm/conversation.js';
import { LlmProvider } from '../../llm/llm.provider.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import {
  AgentRuntime,
  AgentStateUpdate,
  AgentStateValues,
  getAgentContext,
} from '../agent-state.js';
import { emitEvent } from '../emit-event.js';
import { collectTurn } from '../model-turn.js';
import { CATEGORY_TOOLS, FALLBACK_CATEGORY } from '../question-category.js';

export const ANSWER_MAX_OUTPUT_TOKENS = 2000;

/**
 * Una vuelta del modelo con las herramientas de la categoría. El texto no se
 * transmite todavía: es un borrador que primero revisa el verificador.
 */
@Injectable()
export class CallModelNode {
  private readonly maxIterations: number;

  constructor(
    private readonly llm: LlmProvider,
    private readonly tools: ToolRegistry,
    config: ConfigService<Env, true>,
  ) {
    this.maxIterations = config.get('AGENT_MAX_ITERATIONS', { infer: true });
  }

  async run(
    state: AgentStateValues,
    runtime: AgentRuntime,
  ): Promise<AgentStateUpdate> {
    if (state.turns === 0) {
      emitEvent(runtime, { type: 'status', step: 'answering' });
    }
    const turn = state.turns + 1;
    const { logContext, instructions, signal } = getAgentContext(runtime);
    const collected = await collectTurn(
      this.llm.streamTurn({
        logContext,
        instructions,
        items: state.items,
        tools: this.toolsForTurn(state, turn),
        maxOutputTokens: ANSWER_MAX_OUTPUT_TOKENS,
        signal,
      }),
    );
    return {
      items: collected.items,
      pendingToolCalls: collected.toolCalls,
      draft: collected.text,
      turns: turn,
    };
  }

  /** La última vuelta permitida va sin herramientas para obligar al modelo a responder. */
  private toolsForTurn(
    state: AgentStateValues,
    turn: number,
  ): ToolDefinition[] {
    if (turn >= this.maxIterations) {
      return [];
    }
    return this.tools.definitions(
      CATEGORY_TOOLS[state.category ?? FALLBACK_CATEGORY],
    );
  }
}

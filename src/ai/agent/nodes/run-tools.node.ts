import { Injectable } from '@nestjs/common';
import { ConversationItem } from '../../llm/conversation.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import {
  AgentRuntime,
  AgentStateUpdate,
  AgentStateValues,
} from '../agent-state.js';
import { emitEvent } from '../emit-event.js';

/** Ejecuta las herramientas que pidió el modelo y guarda sus resultados como evidencia. */
@Injectable()
export class RunToolsNode {
  constructor(private readonly tools: ToolRegistry) {}

  async run(
    state: AgentStateValues,
    runtime: AgentRuntime,
  ): Promise<AgentStateUpdate> {
    const results: ConversationItem[] = [];
    const evidence: string[] = [];
    for (const call of state.pendingToolCalls) {
      emitEvent(runtime, { type: 'tool', name: call.toolName });
      const output = await this.tools.execute(call.toolName, call.arguments);
      results.push({ kind: 'tool_result', callId: call.callId, output });
      evidence.push(`${call.toolName}: ${output}`);
    }
    return { items: results, evidence, pendingToolCalls: [] };
  }
}

import {
  AgentRuntime,
  AgentStateValues,
} from '../../src/ai/agent/agent-state.js';
import { QuestionCategory } from '../../src/ai/agent/question-category.js';
import { ToolCallItem } from '../../src/ai/llm/conversation.js';
import { AnswerEvent } from '../../src/ai/questions/answer-event.js';

export const AGENT_LOG_CONTEXT = { endpoint: 'ask', conversationId: 'conv-1' };

export function buildAgentState(
  overrides: Partial<AgentStateValues> = {},
): AgentStateValues {
  return {
    question: '¿Cuánto suman las facturas?',
    items: [{ kind: 'user_message', text: '¿Cuánto suman las facturas?' }],
    category: QuestionCategory.Calculation,
    pendingToolCalls: [],
    draft: '',
    evidence: [],
    turns: 0,
    revisions: 0,
    verdict: null,
    ...overrides,
  };
}

/** Runtime de LangGraph falso: guarda los eventos que emiten los nodos. */
export function buildAgentRuntime(signal = new AbortController().signal): {
  runtime: AgentRuntime;
  events: AnswerEvent[];
} {
  const events: AnswerEvent[] = [];
  const runtime = {
    context: {
      logContext: AGENT_LOG_CONTEXT,
      instructions: 'Answer about the collection.',
      signal,
    },
    writer: (event: AnswerEvent) => events.push(event),
  } as unknown as AgentRuntime;
  return { runtime, events };
}

export function buildToolCall(
  callId: string,
  toolName = 'find_documents',
): ToolCallItem {
  return { kind: 'tool_call', callId, toolName, arguments: '{}' };
}

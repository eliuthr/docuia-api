import type {
  FunctionTool,
  ResponseInputItem,
  ResponseOutputItem,
} from 'openai/resources/responses/responses';
import { ConversationItem, ToolDefinition } from './conversation.js';

/** Traduce la conversación neutral a los items de entrada de la Responses API. */
export function toOpenAiInput(items: ConversationItem[]): ResponseInputItem[] {
  return items.map(toOpenAiInputItem);
}

export function toOpenAiTools(tools: ToolDefinition[]): FunctionTool[] {
  return tools.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true,
  }));
}

/** Traduce la salida del modelo a la conversación neutral; ignora items que no usamos. */
export function toConversationItems(
  output: ResponseOutputItem[],
): ConversationItem[] {
  return output.flatMap((item): ConversationItem[] => {
    if (item.type === 'function_call') {
      return [
        {
          kind: 'tool_call',
          callId: item.call_id,
          toolName: item.name,
          arguments: item.arguments,
        },
      ];
    }
    if (item.type === 'message') {
      const text = item.content
        .map((part) => (part.type === 'output_text' ? part.text : ''))
        .join('');
      return text ? [{ kind: 'assistant_message', text }] : [];
    }
    return [];
  });
}

function toOpenAiInputItem(item: ConversationItem): ResponseInputItem {
  switch (item.kind) {
    case 'user_message':
      return { role: 'user', content: item.text };
    case 'assistant_message':
      return { role: 'assistant', content: item.text };
    case 'tool_call':
      return {
        type: 'function_call',
        call_id: item.callId,
        name: item.toolName,
        arguments: item.arguments,
      };
    case 'tool_result':
      return {
        type: 'function_call_output',
        call_id: item.callId,
        output: item.output,
      };
  }
}

import {
  ConversationItem,
  ToolCallItem,
  TurnEvent,
} from '../llm/conversation.js';

export interface CollectedTurn {
  /** Items con los que terminó la vuelta: texto del modelo y llamadas a herramientas. */
  items: ConversationItem[];
  toolCalls: ToolCallItem[];
  /** Todo el texto que escribió el modelo en la vuelta. */
  text: string;
}

/** Consume una vuelta del modelo; `onDelta` recibe el texto a medida que llega. */
export async function collectTurn(
  events: AsyncIterable<TurnEvent>,
  onDelta: (text: string) => void = () => undefined,
): Promise<CollectedTurn> {
  let items: ConversationItem[] = [];
  for await (const event of events) {
    if (event.type === 'text_delta') {
      onDelta(event.text);
      continue;
    }
    items = event.items;
  }
  return {
    items,
    toolCalls: items.filter(
      (item): item is ToolCallItem => item.kind === 'tool_call',
    ),
    text: items
      .filter((item) => item.kind === 'assistant_message')
      .map((item) => item.text)
      .join(''),
  };
}

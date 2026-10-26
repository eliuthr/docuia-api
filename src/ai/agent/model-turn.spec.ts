import { TurnEvent } from '../llm/conversation.js';
import { collectTurn } from './model-turn.js';

async function* stream(events: TurnEvent[]): AsyncIterable<TurnEvent> {
  for (const event of events) {
    yield await Promise.resolve(event);
  }
}

describe('collectTurn', () => {
  it('returns the final items, the tool calls and the text', async () => {
    const toolCall = {
      kind: 'tool_call',
      callId: 'call-1',
      toolName: 'find_documents',
      arguments: '{}',
    } as const;

    const turn = await collectTurn(
      stream([
        { type: 'text_delta', text: 'Bus' },
        { type: 'text_delta', text: 'cando.' },
        {
          type: 'turn_completed',
          items: [{ kind: 'assistant_message', text: 'Buscando.' }, toolCall],
        },
      ]),
    );

    expect(turn).toEqual({
      items: [{ kind: 'assistant_message', text: 'Buscando.' }, toolCall],
      toolCalls: [toolCall],
      text: 'Buscando.',
    });
  });

  it('passes each text delta to the callback', async () => {
    const onDelta = vi.fn();

    await collectTurn(
      stream([
        { type: 'text_delta', text: 'Ho' },
        { type: 'text_delta', text: 'la' },
        { type: 'turn_completed', items: [] },
      ]),
      onDelta,
    );

    expect(onDelta.mock.calls).toEqual([['Ho'], ['la']]);
  });
});

import type { ResponseOutputItem } from 'openai/resources/responses/responses';
import {
  toConversationItems,
  toOpenAiInput,
  toOpenAiTools,
} from './openai-conversation.mapper.js';

describe('openai conversation mapper', () => {
  it('maps every conversation item to a Responses API input item', () => {
    expect(
      toOpenAiInput([
        { kind: 'user_message', text: '¿Cuánto suman?' },
        {
          kind: 'tool_call',
          callId: 'call-1',
          toolName: 'find_documents',
          arguments: '{"text":"Tecno"}',
        },
        { kind: 'tool_result', callId: 'call-1', output: '[]' },
        { kind: 'assistant_message', text: 'No encontré facturas.' },
      ]),
    ).toEqual([
      { role: 'user', content: '¿Cuánto suman?' },
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'find_documents',
        arguments: '{"text":"Tecno"}',
      },
      { type: 'function_call_output', call_id: 'call-1', output: '[]' },
      { role: 'assistant', content: 'No encontré facturas.' },
    ]);
  });

  it('sends tools as strict function tools', () => {
    const parameters = { type: 'object', properties: {} };

    expect(
      toOpenAiTools([{ name: 'tool', description: 'Does it', parameters }]),
    ).toEqual([
      {
        type: 'function',
        name: 'tool',
        description: 'Does it',
        parameters,
        strict: true,
      },
    ]);
  });

  it('maps model output to assistant text and tool calls', () => {
    const output = [
      {
        type: 'message',
        content: [
          { type: 'output_text', text: 'Voy a ' },
          { type: 'output_text', text: 'buscar.' },
        ],
      },
      {
        type: 'function_call',
        call_id: 'call-1',
        name: 'find_documents',
        arguments: '{}',
      },
      { type: 'reasoning', summary: [] },
    ] as unknown as ResponseOutputItem[];

    expect(toConversationItems(output)).toEqual([
      { kind: 'assistant_message', text: 'Voy a buscar.' },
      {
        kind: 'tool_call',
        callId: 'call-1',
        toolName: 'find_documents',
        arguments: '{}',
      },
    ]);
  });

  it('drops messages without text', () => {
    const output = [
      { type: 'message', content: [] },
    ] as unknown as ResponseOutputItem[];

    expect(toConversationItems(output)).toEqual([]);
  });
});

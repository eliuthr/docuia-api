import {
  buildAgentRuntime,
  buildAgentState,
} from '../../../../test/support/agent-fixtures.js';
import { TurnEvent, TurnRequest } from '../../llm/conversation.js';
import { LlmProvider } from '../../llm/llm.provider.js';
import { ANSWER_CONVERSATIONAL_PROMPT } from '../../prompts/answer-conversational.prompt.js';
import { RespondNode } from './respond.node.js';

const TURN: TurnEvent[] = [
  { type: 'text_delta', text: '¡Con ' },
  { type: 'text_delta', text: 'gusto!' },
  {
    type: 'turn_completed',
    items: [{ kind: 'assistant_message', text: '¡Con gusto!' }],
  },
];

describe('RespondNode', () => {
  it('streams a reply without tools as it is written', async () => {
    const requests: TurnRequest[] = [];
    const llm = {
      async *streamTurn(request: TurnRequest) {
        requests.push(request);
        for (const event of TURN) {
          yield await Promise.resolve(event);
        }
      },
    } as unknown as LlmProvider;
    const { runtime, events } = buildAgentRuntime();

    const update = await new RespondNode(llm).run(
      buildAgentState({ question: 'Gracias' }),
      runtime,
    );

    expect(requests[0]).toMatchObject({
      instructions: ANSWER_CONVERSATIONAL_PROMPT,
      tools: [],
    });
    expect(events).toEqual([
      { type: 'status', step: 'answering' },
      { type: 'delta', text: '¡Con ' },
      { type: 'delta', text: 'gusto!' },
    ]);
    expect(update).toEqual({
      items: [{ kind: 'assistant_message', text: '¡Con gusto!' }],
      draft: '¡Con gusto!',
      turns: 1,
    });
  });
});

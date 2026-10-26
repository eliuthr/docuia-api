import {
  buildAgentRuntime,
  buildAgentState,
} from '../../../../test/support/agent-fixtures.js';
import { EmitAnswerNode } from './emit-answer.node.js';

describe('EmitAnswerNode', () => {
  it('sends the accepted draft as one delta', () => {
    const { runtime, events } = buildAgentRuntime();

    new EmitAnswerNode().run(buildAgentState({ draft: '150 USD.' }), runtime);

    expect(events).toEqual([{ type: 'delta', text: '150 USD.' }]);
  });

  it('sends nothing for an empty draft', () => {
    const { runtime, events } = buildAgentRuntime();

    new EmitAnswerNode().run(buildAgentState(), runtime);

    expect(events).toEqual([]);
  });
});

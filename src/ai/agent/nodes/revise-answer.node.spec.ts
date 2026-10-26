import {
  buildAgentRuntime,
  buildAgentState,
} from '../../../../test/support/agent-fixtures.js';
import { buildRevisionRequest } from '../../prompts/revise-answer.prompt.js';
import { ReviseAnswerNode } from './revise-answer.node.js';

describe('ReviseAnswerNode', () => {
  it('asks the model to fix the answer with the reviewer feedback', () => {
    const { runtime, events } = buildAgentRuntime();
    const feedback = 'The total is 119.000 COP.';

    const update = new ReviseAnswerNode().run(
      buildAgentState({ verdict: { verdict: 'unsupported', feedback } }),
      runtime,
    );

    expect(update).toEqual({
      items: [{ kind: 'user_message', text: buildRevisionRequest(feedback) }],
      revisions: 1,
      verdict: null,
    });
    expect(buildRevisionRequest(feedback)).toContain(JSON.stringify(feedback));
    expect(events).toEqual([{ type: 'status', step: 'revising' }]);
  });
});

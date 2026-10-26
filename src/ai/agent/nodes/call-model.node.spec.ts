import { ConfigService } from '@nestjs/config';
import {
  buildAgentRuntime,
  buildAgentState,
  buildToolCall,
} from '../../../../test/support/agent-fixtures.js';
import { Env } from '../../../config/env.schema.js';
import { TurnEvent, TurnRequest } from '../../llm/conversation.js';
import { LlmProvider } from '../../llm/llm.provider.js';
import { ToolName } from '../../tools/tool-name.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import { CATEGORY_TOOLS, QuestionCategory } from '../question-category.js';
import { ANSWER_MAX_OUTPUT_TOKENS, CallModelNode } from './call-model.node.js';

const MAX_ITERATIONS = 3;
const TOOL_DEFINITIONS = [
  { name: ToolName.FindDocuments, description: 'Find', parameters: {} },
];

describe('CallModelNode', () => {
  let turnEvents: TurnEvent[];
  let requests: TurnRequest[];
  let definitions: ReturnType<typeof vi.fn>;
  let node: CallModelNode;

  beforeEach(() => {
    requests = [];
    turnEvents = [
      { type: 'text_delta', text: '119.000 COP' },
      {
        type: 'turn_completed',
        items: [{ kind: 'assistant_message', text: '119.000 COP' }],
      },
    ];
    const llm = {
      async *streamTurn(request: TurnRequest) {
        requests.push(request);
        for (const event of turnEvents) {
          yield await Promise.resolve(event);
        }
      },
    } as unknown as LlmProvider;
    definitions = vi.fn().mockReturnValue(TOOL_DEFINITIONS);
    const config = {
      get: vi.fn().mockReturnValue(MAX_ITERATIONS),
    } as unknown as ConfigService<Env, true>;
    node = new CallModelNode(
      llm,
      { definitions } as unknown as ToolRegistry,
      config,
    );
  });

  it('buffers the answer as a draft instead of streaming it', async () => {
    const { runtime, events } = buildAgentRuntime();

    await expect(node.run(buildAgentState(), runtime)).resolves.toEqual({
      items: [{ kind: 'assistant_message', text: '119.000 COP' }],
      pendingToolCalls: [],
      draft: '119.000 COP',
      turns: 1,
    });
    expect(events).toEqual([{ type: 'status', step: 'answering' }]);
  });

  it('offers only the tools of the category', async () => {
    const { runtime } = buildAgentRuntime();

    await node.run(
      buildAgentState({ category: QuestionCategory.Calculation }),
      runtime,
    );

    expect(definitions).toHaveBeenCalledWith(
      CATEGORY_TOOLS[QuestionCategory.Calculation],
    );
    expect(requests[0]).toMatchObject({
      instructions: 'Answer about the collection.',
      tools: TOOL_DEFINITIONS,
      maxOutputTokens: ANSWER_MAX_OUTPUT_TOKENS,
    });
  });

  it('returns the tool calls the model asked for', async () => {
    const call = buildToolCall('call-1');
    turnEvents = [{ type: 'turn_completed', items: [call] }];

    const update = await node.run(
      buildAgentState(),
      buildAgentRuntime().runtime,
    );

    expect(update.pendingToolCalls).toEqual([call]);
  });

  it('sends the last allowed turn without tools', async () => {
    const { runtime, events } = buildAgentRuntime();

    await node.run(buildAgentState({ turns: MAX_ITERATIONS - 1 }), runtime);

    expect(requests[0].tools).toEqual([]);
    expect(events).toEqual([]);
  });

  it('passes the request signal to the model', async () => {
    const controller = new AbortController();

    await node.run(
      buildAgentState(),
      buildAgentRuntime(controller.signal).runtime,
    );

    expect(requests[0].signal).toBe(controller.signal);
  });
});

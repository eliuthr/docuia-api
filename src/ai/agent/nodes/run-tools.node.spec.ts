import {
  buildAgentRuntime,
  buildAgentState,
  buildToolCall,
} from '../../../../test/support/agent-fixtures.js';
import { ToolRegistry } from '../../tools/tool-registry.js';
import { RunToolsNode } from './run-tools.node.js';

describe('RunToolsNode', () => {
  it('runs each pending call and keeps its result as evidence', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce('{"count":2}')
      .mockResolvedValueOnce('{"total":150}');
    const node = new RunToolsNode({ execute } as unknown as ToolRegistry);
    const { runtime, events } = buildAgentRuntime();

    const update = await node.run(
      buildAgentState({
        pendingToolCalls: [
          buildToolCall('call-1', 'find_documents'),
          buildToolCall('call-2', 'sum_invoice_totals'),
        ],
      }),
      runtime,
    );

    expect(execute).toHaveBeenNthCalledWith(1, 'find_documents', '{}');
    expect(update).toEqual({
      items: [
        { kind: 'tool_result', callId: 'call-1', output: '{"count":2}' },
        { kind: 'tool_result', callId: 'call-2', output: '{"total":150}' },
      ],
      evidence: [
        'find_documents: {"count":2}',
        'sum_invoice_totals: {"total":150}',
      ],
      pendingToolCalls: [],
    });
    expect(events).toEqual([
      { type: 'tool', name: 'find_documents' },
      { type: 'tool', name: 'sum_invoice_totals' },
    ]);
  });
});

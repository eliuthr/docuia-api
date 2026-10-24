import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import {
  ConversationItem,
  TurnEvent,
  TurnRequest,
} from '../llm/conversation.js';
import { LlmProvider } from '../llm/llm.provider.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { AnswerEvent } from './answer-event.js';
import { ToolLoopRequest, ToolLoopService } from './tool-loop.service.js';

const MAX_ITERATIONS = 3;
const TOOL_DEFINITIONS = [
  { name: 'find_documents', description: 'Find', parameters: {} },
];

function toolCall(callId: string, toolName = 'find_documents') {
  return { kind: 'tool_call', callId, toolName, arguments: '{}' } as const;
}

/** Vuelta del LLM falso: texto que transmite y items con los que termina. */
function turn(text: string, items: ConversationItem[] = []): TurnEvent[] {
  const deltas: TurnEvent[] = text ? [{ type: 'text_delta', text }] : [];
  const finalItems: ConversationItem[] = text
    ? [{ kind: 'assistant_message', text }, ...items]
    : items;
  return [...deltas, { type: 'turn_completed', items: finalItems }];
}

async function collect(
  events: AsyncIterable<AnswerEvent>,
): Promise<AnswerEvent[]> {
  const collected: AnswerEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

describe('ToolLoopService', () => {
  let scriptedTurns: TurnEvent[][];
  let requests: TurnRequest[];
  let execute: ReturnType<typeof vi.fn>;
  let service: ToolLoopService;

  const request: ToolLoopRequest = {
    logContext: { endpoint: 'ask' },
    instructions: 'Answer.',
    question: '¿Cuánto suman las facturas?',
    signal: new AbortController().signal,
  };

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    scriptedTurns = [];
    requests = [];
    const llm = {
      async *streamTurn(turnRequest: TurnRequest) {
        requests.push(turnRequest);
        for (const event of scriptedTurns.shift() ?? []) {
          yield await Promise.resolve(event);
        }
      },
    } as unknown as LlmProvider;
    execute = vi.fn().mockResolvedValue('{"count":0}');
    const tools = {
      definitions: () => TOOL_DEFINITIONS,
      execute,
    } as unknown as ToolRegistry;
    const config = {
      get: vi.fn().mockReturnValue(MAX_ITERATIONS),
    } as unknown as ConfigService<Env, true>;
    service = new ToolLoopService(llm, tools, config);
  });

  it('streams a direct answer when no tool is needed', async () => {
    scriptedTurns = [turn('Hola.')];

    await expect(collect(service.run(request))).resolves.toEqual([
      { type: 'delta', text: 'Hola.' },
      { type: 'done' },
    ]);
    expect(requests).toHaveLength(1);
  });

  it('runs the requested tool and sends its result back to the model', async () => {
    scriptedTurns = [turn('', [toolCall('call-1')]), turn('No hay facturas.')];

    const events = await collect(service.run(request));

    expect(events).toEqual([
      { type: 'tool', name: 'find_documents' },
      { type: 'delta', text: 'No hay facturas.' },
      { type: 'done' },
    ]);
    expect(execute).toHaveBeenCalledWith('find_documents', '{}');
    expect(requests[1].items).toEqual([
      { kind: 'user_message', text: '¿Cuánto suman las facturas?' },
      toolCall('call-1'),
      { kind: 'tool_result', callId: 'call-1', output: '{"count":0}' },
    ]);
  });

  it('runs every tool requested in the same turn', async () => {
    scriptedTurns = [
      turn('', [
        toolCall('call-1', 'find_documents'),
        toolCall('call-2', 'sum_invoice_totals'),
      ]),
      turn('Listo.'),
    ];

    const events = await collect(service.run(request));

    expect(events.filter((event) => event.type === 'tool')).toEqual([
      { type: 'tool', name: 'find_documents' },
      { type: 'tool', name: 'sum_invoice_totals' },
    ]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('offers tools on every turn except the last one', async () => {
    scriptedTurns = [
      turn('', [toolCall('call-1')]),
      turn('', [toolCall('call-2')]),
      turn('Respuesta final.'),
    ];

    await collect(service.run(request));

    expect(requests.map((turnRequest) => turnRequest.tools)).toEqual([
      TOOL_DEFINITIONS,
      TOOL_DEFINITIONS,
      [],
    ]);
  });

  it('never calls the model more than AGENT_MAX_ITERATIONS times', async () => {
    scriptedTurns = Array.from({ length: 10 }, (_turn, index) =>
      turn('', [toolCall(`call-${index}`)]),
    );

    const events = await collect(service.run(request));

    expect(requests).toHaveLength(MAX_ITERATIONS);
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('passes the abort signal to the model', async () => {
    scriptedTurns = [turn('Hola.')];

    await collect(service.run(request));

    expect(requests[0].signal).toBe(request.signal);
  });
});

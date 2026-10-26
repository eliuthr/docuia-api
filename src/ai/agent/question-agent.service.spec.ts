import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildToolCall } from '../../../test/support/agent-fixtures.js';
import { Env } from '../../config/env.schema.js';
import { StructuredOutputService } from '../extraction/structured-output.service.js';
import {
  ConversationItem,
  TurnEvent,
  TurnRequest,
} from '../llm/conversation.js';
import { LlmProvider } from '../llm/llm.provider.js';
import { AnswerEvent } from '../questions/answer-event.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { CallModelNode } from './nodes/call-model.node.js';
import { ClassifyQuestionNode } from './nodes/classify-question.node.js';
import { EmitAnswerNode } from './nodes/emit-answer.node.js';
import { RespondNode } from './nodes/respond.node.js';
import { ReviseAnswerNode } from './nodes/revise-answer.node.js';
import { RunToolsNode } from './nodes/run-tools.node.js';
import { VerifyAnswerNode } from './nodes/verify-answer.node.js';
import {
  AgentRunRequest,
  QuestionAgentService,
} from './question-agent.service.js';
import { QuestionCategory } from './question-category.js';
import { QuestionGraphFactory } from './question-graph.factory.js';

const MAX_ITERATIONS = 3;
const SUPPORTED = { verdict: 'supported', feedback: '' };
const UNSUPPORTED = { verdict: 'unsupported', feedback: 'Wrong total.' };

/** Vuelta del LLM falso: texto que transmite y items con los que termina. */
function turn(text: string, items: ConversationItem[] = []): TurnEvent[] {
  const deltas: TurnEvent[] = text ? [{ type: 'text_delta', text }] : [];
  const finalItems: ConversationItem[] = text
    ? [{ kind: 'assistant_message', text }, ...items]
    : items;
  return [...deltas, { type: 'turn_completed', items: finalItems }];
}

async function runToEnd(
  events: AsyncGenerator<AnswerEvent, string>,
): Promise<{ events: AnswerEvent[]; answer: string }> {
  const collected: AnswerEvent[] = [];
  let result = await events.next();
  while (!result.done) {
    collected.push(result.value);
    result = await events.next();
  }
  return { events: collected, answer: result.value };
}

describe('QuestionAgentService', () => {
  let scriptedTurns: TurnEvent[][];
  let turnRequests: TurnRequest[];
  let category: QuestionCategory;
  let verdicts: object[];
  let execute: ReturnType<typeof vi.fn>;
  let service: QuestionAgentService;

  function buildRequest(
    signal = new AbortController().signal,
  ): AgentRunRequest {
    return {
      logContext: { endpoint: 'ask' },
      instructions: 'Answer about the collection.',
      history: [
        { kind: 'user_message', text: '¿Qué facturas hay?' },
        { kind: 'assistant_message', text: 'Dos facturas.' },
      ],
      question: '¿Cuánto suman?',
      signal,
    };
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    scriptedTurns = [];
    turnRequests = [];
    category = QuestionCategory.Calculation;
    verdicts = [SUPPORTED];
    const llm = {
      async *streamTurn(request: TurnRequest) {
        turnRequests.push(request);
        for (const event of scriptedTurns.shift() ?? turn('')) {
          yield await Promise.resolve(event);
        }
      },
    } as unknown as LlmProvider;
    const structuredOutput = {
      generate: vi.fn(({ schemaName }: { schemaName: string }) =>
        Promise.resolve(
          schemaName === 'question_classification'
            ? { category }
            : verdicts.shift(),
        ),
      ),
    } as unknown as StructuredOutputService;
    execute = vi.fn().mockResolvedValue('{"total":150}');
    const tools = {
      definitions: () => [],
      execute,
    } as unknown as ToolRegistry;
    const config = {
      get: vi.fn().mockReturnValue(MAX_ITERATIONS),
    } as unknown as ConfigService<Env, true>;
    const factory = new QuestionGraphFactory(
      new ClassifyQuestionNode(structuredOutput),
      new RespondNode(llm),
      new CallModelNode(llm, tools, config),
      new RunToolsNode(tools),
      new VerifyAnswerNode(structuredOutput),
      new ReviseAnswerNode(),
      new EmitAnswerNode(),
      config,
    );
    service = new QuestionAgentService(factory, config);
  });

  it('streams a conversational reply without tools or verification', async () => {
    category = QuestionCategory.Conversational;
    scriptedTurns = [turn('¡Hola!')];

    await expect(runToEnd(service.run(buildRequest()))).resolves.toEqual({
      events: [
        { type: 'status', step: 'classifying' },
        { type: 'status', step: 'answering' },
        { type: 'delta', text: '¡Hola!' },
      ],
      answer: '¡Hola!',
    });
  });

  it('uses tools, verifies the draft and then sends it', async () => {
    scriptedTurns = [
      turn('', [buildToolCall('call-1')]),
      turn('Suman 150 USD.'),
    ];

    await expect(runToEnd(service.run(buildRequest()))).resolves.toEqual({
      events: [
        { type: 'status', step: 'classifying' },
        { type: 'status', step: 'answering' },
        { type: 'tool', name: 'find_documents' },
        { type: 'status', step: 'verifying' },
        { type: 'delta', text: 'Suman 150 USD.' },
      ],
      answer: 'Suman 150 USD.',
    });
  });

  it('sends the history before the new question', async () => {
    scriptedTurns = [turn('Suman 150 USD.')];

    await runToEnd(service.run(buildRequest()));

    expect(turnRequests[0].items).toEqual([
      { kind: 'user_message', text: '¿Qué facturas hay?' },
      { kind: 'assistant_message', text: 'Dos facturas.' },
      { kind: 'user_message', text: '¿Cuánto suman?' },
    ]);
  });

  it('revises an unsupported draft once and sends the revised answer', async () => {
    verdicts = [UNSUPPORTED, SUPPORTED];
    scriptedTurns = [
      turn('', [buildToolCall('call-1')]),
      turn('Suman 190 USD.'),
      turn('Suman 150 USD.'),
    ];

    const { events, answer } = await runToEnd(service.run(buildRequest()));

    expect(answer).toBe('Suman 150 USD.');
    expect(events).toContainEqual({ type: 'status', step: 'revising' });
    expect(events.filter((event) => event.type === 'delta')).toEqual([
      { type: 'delta', text: 'Suman 150 USD.' },
    ]);
  });

  it('makes the last allowed turn without tools', async () => {
    scriptedTurns = [
      turn('', [buildToolCall('call-1')]),
      turn('', [buildToolCall('call-2')]),
      turn('No pude calcularlo.'),
    ];

    const { answer } = await runToEnd(service.run(buildRequest()));

    expect(turnRequests).toHaveLength(MAX_ITERATIONS);
    expect(turnRequests[MAX_ITERATIONS - 1].tools).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(answer).toBe('No pude calcularlo.');
  });

  it('stops when the request is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runToEnd(service.run(buildRequest(controller.signal))),
    ).rejects.toThrow();
    expect(turnRequests).toEqual([]);
  });
});

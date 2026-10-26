import { ConversationsService } from '../../conversations/conversations.service.js';
import {
  AgentRunRequest,
  QuestionAgentService,
} from '../agent/question-agent.service.js';
import { AnswerEvent } from './answer-event.js';
import {
  ConversationAnswerRequest,
  ConversationAnswerService,
} from './conversation-answer.service.js';

const NOW = new Date('2026-10-26T15:00:00.000Z');

const request: ConversationAnswerRequest = {
  conversationId: 'conv-1',
  logContext: { endpoint: 'ask', conversationId: 'conv-1' },
  instructions: 'Answer.',
  question: '¿Y el total?',
  signal: new AbortController().signal,
};

async function collect(
  events: AsyncIterable<AnswerEvent>,
): Promise<AnswerEvent[]> {
  const collected: AnswerEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

describe('ConversationAnswerService', () => {
  let agentRequests: AgentRunRequest[];
  let agentFailure: Error | null;
  let recentMessages: ReturnType<typeof vi.fn>;
  let appendExchange: ReturnType<typeof vi.fn>;
  let service: ConversationAnswerService;

  beforeEach(() => {
    agentRequests = [];
    agentFailure = null;
    recentMessages = vi.fn().mockResolvedValue([
      { role: 'user', text: '¿Quién es el proveedor?', createdAt: NOW },
      { role: 'assistant', text: 'Tecnosuministros.', createdAt: NOW },
    ]);
    appendExchange = vi.fn().mockResolvedValue(undefined);
    const agent = {
      async *run(runRequest: AgentRunRequest) {
        agentRequests.push(runRequest);
        yield await Promise.resolve({ type: 'delta', text: '119.000 COP' });
        if (agentFailure) {
          throw agentFailure;
        }
        return '119.000 COP';
      },
    } as unknown as QuestionAgentService;
    service = new ConversationAnswerService(
      { recentMessages, appendExchange } as unknown as ConversationsService,
      agent,
    );
  });

  it('sends the conversation id first and done last', async () => {
    await expect(collect(service.answer(request))).resolves.toEqual([
      { type: 'conversation', id: 'conv-1' },
      { type: 'delta', text: '119.000 COP' },
      { type: 'done' },
    ]);
  });

  it('gives the agent the recent history as conversation items', async () => {
    await collect(service.answer(request));

    expect(agentRequests[0]).toEqual({
      logContext: request.logContext,
      instructions: 'Answer.',
      history: [
        { kind: 'user_message', text: '¿Quién es el proveedor?' },
        { kind: 'assistant_message', text: 'Tecnosuministros.' },
      ],
      question: '¿Y el total?',
      signal: request.signal,
    });
  });

  it('stores the question and the final answer when the answer completes', async () => {
    await collect(service.answer(request));

    expect(appendExchange).toHaveBeenCalledWith('conv-1', {
      question: '¿Y el total?',
      answer: '119.000 COP',
      askedAt: expect.any(Date) as unknown,
      answeredAt: expect.any(Date) as unknown,
    });
  });

  it('stores nothing when the answer fails', async () => {
    agentFailure = new Error('LLM down');

    await expect(collect(service.answer(request))).rejects.toThrow('LLM down');
    expect(appendExchange).not.toHaveBeenCalled();
  });
});

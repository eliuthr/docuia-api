import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request, { Response } from 'supertest';
import { QuestionCategory } from '../src/ai/agent/question-category.js';
import { TurnEvent } from '../src/ai/llm/conversation.js';
import { LlmProvider } from '../src/ai/llm/llm.provider.js';
import { DocumentStatus } from '../src/documents/domain/document-status.enum.js';
import { DocumentRepository } from '../src/documents/repositories/document.repository.js';
import { buildDocument } from './support/build-document.js';
import { createTestApp } from './support/create-test-app.js';
import { ScriptedLlmProvider } from './support/scripted-llm.provider.js';

const QUESTION = {
  question: '¿Cuánto suman las facturas de Tecnosuministros?',
};
const FIND_INVOICES_ARGUMENTS =
  '{"documentType":"invoice","text":"Tecnosuministros","limit":5}';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SUPPORTED = { verdict: 'supported', feedback: '' };

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

/** Lee el cuerpo completo del stream SSE como texto. */
function readStream(
  response: Response,
  callback: (error: Error | null, body: string) => void,
): void {
  let body = '';
  response.setEncoding('utf8');
  response.on('data', (chunk: string) => (body += chunk));
  response.on('end', () => callback(null, body));
}

function parseEvents(body: string): SseEvent[] {
  return body
    .trim()
    .split('\n\n')
    .map((block) => {
      const [eventLine, dataLine] = block.split('\n');
      return {
        event: eventLine.replace('event: ', ''),
        data: JSON.parse(dataLine.replace('data: ', '')) as Record<
          string,
          unknown
        >,
      };
    });
}

/** Vuelta del modelo falso que responde con texto, en uno o varios pedazos. */
function textTurn(...pieces: string[]): TurnEvent[] {
  return [
    ...pieces.map((text): TurnEvent => ({ type: 'text_delta', text })),
    {
      type: 'turn_completed',
      items: [{ kind: 'assistant_message', text: pieces.join('') }],
    },
  ];
}

function findInvoicesTurn(): TurnEvent[] {
  return [
    {
      type: 'turn_completed',
      items: [
        {
          kind: 'tool_call',
          callId: 'call-1',
          toolName: 'find_documents',
          arguments: FIND_INVOICES_ARGUMENTS,
        },
      ],
    },
  ];
}

describe('Questions (e2e)', () => {
  let app: INestApplication;
  let llm: ScriptedLlmProvider;
  let invoiceId: string;
  let pendingId: string;

  function ask(path: string, body: object) {
    return request(app.getHttpServer())
      .post(path)
      .send(body)
      .buffer(true)
      .parse(readStream)
      .expect(200);
  }

  /** Guion de una pregunta con herramientas: clasificación, vueltas y veredictos. */
  function scriptToolAnswer(turns: TurnEvent[][], ...verdicts: object[]) {
    llm.script(...turns);
    llm.scriptStructured('question_classification', {
      category: QuestionCategory.Calculation,
    });
    llm.scriptStructured('answer_verdict', ...verdicts);
  }

  beforeAll(async () => {
    app = await createTestApp();
    llm = app.get(LlmProvider);
    const repository = app.get(DocumentRepository);
    invoiceId = randomUUID();
    pendingId = randomUUID();
    await repository.create(buildDocument({ id: invoiceId }));
    await repository.create(
      buildDocument({ id: pendingId, status: DocumentStatus.Pending }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /ask', () => {
    it('streams the agent steps and the verified answer as server-sent events', async () => {
      scriptToolAnswer(
        [findInvoicesTurn(), textTurn('Suman ', '1.000 COP.')],
        SUPPORTED,
      );

      const response = await ask('/ask', QUESTION);

      expect(response.headers['content-type']).toContain('text/event-stream');
      const events = parseEvents(response.body as string);
      expect(events[0].event).toBe('conversation');
      expect(events[0].data.id).toMatch(UUID_PATTERN);
      expect(events.slice(1)).toEqual([
        { event: 'status', data: { step: 'classifying' } },
        { event: 'status', data: { step: 'answering' } },
        { event: 'tool', data: { name: 'find_documents' } },
        { event: 'status', data: { step: 'verifying' } },
        { event: 'delta', data: { text: 'Suman 1.000 COP.' } },
        { event: 'done', data: {} },
      ]);
    });

    it('runs the tool against stored documents and sends the result back', async () => {
      scriptToolAnswer([findInvoicesTurn(), textTurn('Listo.')], SUPPORTED);

      await ask('/ask', QUESTION);

      const toolResult = llm.requests[1].items.at(-1);
      expect(toolResult).toMatchObject({
        kind: 'tool_result',
        callId: 'call-1',
      });
      expect(JSON.stringify(toolResult)).toContain(invoiceId);
      expect(JSON.stringify(toolResult)).not.toContain(pendingId);
    });

    it('revises an unsupported answer and sends only the revised one', async () => {
      scriptToolAnswer(
        [
          findInvoicesTurn(),
          textTurn('Suman 9.000 COP.'),
          textTurn('Suman 1.000 COP.'),
        ],
        { verdict: 'unsupported', feedback: 'The total is 1.000 COP.' },
        SUPPORTED,
      );

      const response = await ask('/ask', QUESTION);

      const events = parseEvents(response.body as string);
      expect(events).toContainEqual({
        event: 'status',
        data: { step: 'revising' },
      });
      expect(events.filter(({ event }) => event === 'delta')).toEqual([
        { event: 'delta', data: { text: 'Suman 1.000 COP.' } },
      ]);
    });

    it('streams a conversational reply as it is written, without verification', async () => {
      llm.script(textTurn('¡Con ', 'gusto!'));
      llm.scriptStructured('question_classification', {
        category: QuestionCategory.Conversational,
      });

      const response = await ask('/ask', { question: 'Gracias' });

      const events = parseEvents(response.body as string);
      expect(events.map(({ event }) => event)).toEqual([
        'conversation',
        'status',
        'status',
        'delta',
        'delta',
        'done',
      ]);
      expect(llm.requests[0].tools).toEqual([]);
    });

    it('sends an error event when the model fails mid-answer', async () => {
      llm.script(new Error('OpenAI 500 with internal details'));
      llm.scriptStructured('question_classification', {
        category: QuestionCategory.Lookup,
      });

      const response = await ask('/ask', QUESTION);

      const events = parseEvents(response.body as string);
      expect(events.at(-1)).toEqual({
        event: 'error',
        data: { message: 'The answer could not be completed. Try again.' },
      });
      expect(response.body).not.toContain('internal details');
      expect(events.map(({ event }) => event)).not.toContain('done');
    });

    it.each([
      ['an empty question', { question: '   ' }],
      ['a question that is too long', { question: 'x'.repeat(1001) }],
      ['a missing question', {}],
      [
        'a conversationId that is not a UUID',
        { ...QUESTION, conversationId: '12' },
      ],
    ])('rejects %s with 400', async (_case, body) => {
      await request(app.getHttpServer()).post('/ask').send(body).expect(400);
    });

    it('responds 404 for an unknown conversation', async () => {
      await request(app.getHttpServer())
        .post('/ask')
        .send({ ...QUESTION, conversationId: randomUUID() })
        .expect(404);
    });
  });

  describe('POST /documents/:id/ask', () => {
    it('streams an answer about a ready document', async () => {
      llm.script(textTurn('El total es 1.000 COP.'));
      llm.scriptStructured('question_classification', {
        category: QuestionCategory.Lookup,
      });

      const response = await ask(`/documents/${invoiceId}/ask`, {
        question: '¿Cuál es el total?',
      });

      expect(response.body).toContain('event: done');
      expect(llm.requests[0].instructions).toContain(invoiceId);
    });

    it('responds 404 for an unknown document', async () => {
      await request(app.getHttpServer())
        .post(`/documents/${randomUUID()}/ask`)
        .send(QUESTION)
        .expect(404);
    });

    it('responds 409 for a document that is not ready', async () => {
      await request(app.getHttpServer())
        .post(`/documents/${pendingId}/ask`)
        .send(QUESTION)
        .expect(409);
    });

    it('responds 400 for an id that is not a UUID', async () => {
      await request(app.getHttpServer())
        .post('/documents/not-a-uuid/ask')
        .send(QUESTION)
        .expect(400);
    });
  });

  describe('conversations', () => {
    /** Hace una pregunta sin herramientas y devuelve el id de la conversación. */
    async function askDirectly(
      path: string,
      question: string,
      answer: string,
      conversationId?: string,
    ): Promise<string> {
      llm.script(textTurn(answer));
      llm.scriptStructured('question_classification', {
        category: QuestionCategory.Lookup,
      });
      const response = await ask(path, { question, conversationId });
      const [first] = parseEvents(response.body as string);
      return first.data.id as string;
    }

    it('sends the history of the conversation in follow-up questions', async () => {
      const conversationId = await askDirectly(
        `/documents/${invoiceId}/ask`,
        '¿Quién es el proveedor?',
        'Tecnosuministros.',
      );

      const followUpId = await askDirectly(
        `/documents/${invoiceId}/ask`,
        '¿Y el total?',
        '1.000 COP.',
        conversationId,
      );

      expect(followUpId).toBe(conversationId);
      expect(llm.requests[0].items).toEqual([
        { kind: 'user_message', text: '¿Quién es el proveedor?' },
        { kind: 'assistant_message', text: 'Tecnosuministros.' },
        { kind: 'user_message', text: '¿Y el total?' },
      ]);
    });

    it('lists and reads the conversations of a document', async () => {
      const conversationId = await askDirectly(
        `/documents/${invoiceId}/ask`,
        '¿Cuál es la fecha?',
        'El 1 de octubre.',
      );

      const list = await request(app.getHttpServer())
        .get(`/conversations?documentId=${invoiceId}`)
        .expect(200);
      expect(list.body).toContainEqual(
        expect.objectContaining({
          id: conversationId,
          documentId: invoiceId,
          title: '¿Cuál es la fecha?',
          messageCount: 2,
        }),
      );

      const detail = await request(app.getHttpServer())
        .get(`/conversations/${conversationId}`)
        .expect(200);
      expect(detail.body).toMatchObject({
        id: conversationId,
        messages: [
          { role: 'user', text: '¿Cuál es la fecha?' },
          { role: 'assistant', text: 'El 1 de octubre.' },
        ],
      });
    });

    it('keeps collection and document conversations apart', async () => {
      const documentConversationId = await askDirectly(
        `/documents/${invoiceId}/ask`,
        '¿Proveedor?',
        'Tecnosuministros.',
      );

      await request(app.getHttpServer())
        .post('/ask')
        .send({ ...QUESTION, conversationId: documentConversationId })
        .expect(400);
      const collection = await request(app.getHttpServer())
        .get('/conversations')
        .expect(200);
      expect(collection.body).not.toContainEqual(
        expect.objectContaining({ id: documentConversationId }),
      );
    });

    it('stores nothing when the answer fails', async () => {
      llm.script(new Error('LLM down'));
      llm.scriptStructured('question_classification', {
        category: QuestionCategory.Lookup,
      });

      const response = await ask('/ask', { question: '¿Contratos?' });
      const [first] = parseEvents(response.body as string);

      const detail = await request(app.getHttpServer())
        .get(`/conversations/${first.data.id as string}`)
        .expect(200);
      expect(detail.body).toMatchObject({ messageCount: 0, messages: [] });
    });

    it('responds 404 for an unknown conversation and 400 for a bad id', async () => {
      await request(app.getHttpServer())
        .get(`/conversations/${randomUUID()}`)
        .expect(404);
      await request(app.getHttpServer())
        .get('/conversations/not-a-uuid')
        .expect(400);
      await request(app.getHttpServer())
        .get('/conversations?documentId=not-a-uuid')
        .expect(400);
    });
  });
});

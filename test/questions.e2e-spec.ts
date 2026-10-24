import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request, { Response } from 'supertest';
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

describe('Questions (e2e)', () => {
  let app: INestApplication;
  let llm: ScriptedLlmProvider;
  let invoiceId: string;
  let pendingId: string;

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
    it('streams tool use and the answer as server-sent events', async () => {
      llm.script(
        [
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
        ],
        [
          { type: 'text_delta', text: 'Suman ' },
          { type: 'text_delta', text: '1.000 COP.' },
          { type: 'turn_completed', items: [] },
        ],
      );

      const response = await request(app.getHttpServer())
        .post('/ask')
        .send(QUESTION)
        .buffer(true)
        .parse(readStream)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.body).toBe(
        'event: tool\ndata: {"name":"find_documents"}\n\n' +
          'event: delta\ndata: {"text":"Suman "}\n\n' +
          'event: delta\ndata: {"text":"1.000 COP."}\n\n' +
          'event: done\ndata: {}\n\n',
      );
    });

    it('runs the tool against stored documents and sends the result back', async () => {
      llm.script(
        [
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
        ],
        [{ type: 'turn_completed', items: [] }],
      );

      await request(app.getHttpServer())
        .post('/ask')
        .send(QUESTION)
        .buffer(true)
        .parse(readStream)
        .expect(200);

      const toolResult = llm.requests[1].items.at(-1);
      expect(toolResult).toMatchObject({
        kind: 'tool_result',
        callId: 'call-1',
      });
      expect(JSON.stringify(toolResult)).toContain(invoiceId);
      expect(JSON.stringify(toolResult)).not.toContain(pendingId);
    });

    it('sends an error event when the model fails mid-answer', async () => {
      llm.script(new Error('OpenAI 500 with internal details'));

      const response = await request(app.getHttpServer())
        .post('/ask')
        .send(QUESTION)
        .buffer(true)
        .parse(readStream)
        .expect(200);

      expect(response.body).toBe(
        'event: error\ndata: {"message":"The answer could not be completed. Try again."}\n\n',
      );
    });

    it.each([
      ['an empty question', { question: '   ' }],
      ['a question that is too long', { question: 'x'.repeat(1001) }],
      ['a missing question', {}],
    ])('rejects %s with 400', async (_case, body) => {
      await request(app.getHttpServer()).post('/ask').send(body).expect(400);
    });
  });

  describe('POST /documents/:id/ask', () => {
    it('streams an answer about a ready document', async () => {
      llm.script([
        { type: 'text_delta', text: 'El total es 1.000 COP.' },
        { type: 'turn_completed', items: [] },
      ]);

      const response = await request(app.getHttpServer())
        .post(`/documents/${invoiceId}/ask`)
        .send({ question: '¿Cuál es el total?' })
        .buffer(true)
        .parse(readStream)
        .expect(200);

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
});

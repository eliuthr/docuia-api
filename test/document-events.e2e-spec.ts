import { INestApplication } from '@nestjs/common';
import { request as httpRequest } from 'node:http';
import { AddressInfo } from 'node:net';
import { DocumentEventsSubscriber } from '../src/documents/events/document-events.subscriber.js';
import { DocumentStatus } from '../src/documents/domain/document-status.enum.js';
import { createTestApp } from './support/create-test-app.js';
import { InMemoryDocumentEvents } from './support/in-memory-document-events.js';

interface StreamResult {
  contentType: string | undefined;
  body: string;
}

/**
 * Abre el stream SSE, ejecuta `onOpen` cuando la conexión está lista y
 * devuelve lo recibido hasta que aparece `expectedText`. El stream no termina
 * solo, así que se usa `http` directamente y se corta la conexión al final.
 */
function readStreamUntil(
  port: number,
  expectedText: string,
  onOpen: () => void,
): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        port,
        path: '/documents/events',
        headers: { Accept: 'text/event-stream' },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
          if (body.includes(expectedText)) {
            request.destroy();
            resolve({ contentType: response.headers['content-type'], body });
          }
        });
        onOpen();
      },
    );
    request.on('error', reject);
    request.end();
  });
}

describe('Document events (e2e)', () => {
  let app: INestApplication;
  let events: InMemoryDocumentEvents;
  let port: number;

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
    events = app.get(DocumentEventsSubscriber);
  });

  afterAll(async () => {
    await app.close();
  });

  // Si la ruta se confundiera con `/documents/:id`, aquí llegaría un 400 de validación.
  it('streams status changes as document.updated events', async () => {
    const result = await readStreamUntil(port, 'document.updated', () =>
      events.emit({ documentId: 'doc-1', status: DocumentStatus.Ready }),
    );

    expect(result.contentType).toContain('text/event-stream');
    expect(result.body).toContain('event: document.updated\n');
    expect(result.body).toContain(
      'data: {"documentId":"doc-1","status":"ready"}\n',
    );
  });
});

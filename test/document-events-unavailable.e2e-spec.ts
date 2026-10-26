import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NoneDocumentEventsSubscriberModule } from '../src/documents/events/none-document-events-subscriber.module.js';
import { createTestApp } from './support/create-test-app.js';

describe('GET /documents/events without live events (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(NoneDocumentEventsSubscriberModule);
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds 503 with JSON instead of opening the stream', async () => {
    const response = await request(app.getHttpServer())
      .get('/documents/events')
      .set('Accept', 'text/event-stream')
      .expect(503);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toMatchObject({
      message:
        'Live status updates are not available. Poll GET /documents/:id instead.',
    });
  });
});

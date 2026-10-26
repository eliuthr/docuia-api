import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import request from 'supertest';
import { DocumentRepository } from '../src/documents/repositories/document.repository.js';
import { QueueProvider } from '../src/processing/queue/queue.provider.js';
import { buildDocument } from './support/build-document.js';
import { createTestApp } from './support/create-test-app.js';
import { InMemoryQueueProvider } from './support/in-memory-queue.provider.js';

const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR ?? '';
const MEGABYTE = 1024 * 1024;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

async function storedFileCount(): Promise<number> {
  const entries = await readdir(STORAGE_DIR).catch(() => []);
  return entries.length;
}

describe('Documents (e2e)', () => {
  let app: INestApplication;
  let queue: InMemoryQueueProvider;

  beforeAll(async () => {
    app = await createTestApp();
    queue = app.get(QueueProvider);
  });

  afterEach(() => {
    queue.isUnavailable = false;
  });

  afterAll(async () => {
    await app.close();
    await rm(STORAGE_DIR, { recursive: true, force: true });
  });

  describe('POST /documents', () => {
    it('stores a PDF as a pending document', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', MINIMAL_PDF, 'invoice-001.pdf')
        .expect(201);

      expect(response.body).toMatchObject({
        originalName: 'invoice-001.pdf',
        mimeType: 'application/pdf',
        sizeBytes: MINIMAL_PDF.length,
        status: 'pending',
        pageCount: null,
        failureReason: null,
        documentType: null,
        summary: null,
        extractedData: null,
      });
      expect(response.body.id).toMatch(UUID_V4_PATTERN);
      expect(response.body).not.toHaveProperty('storageKey');
      expect(response.body).not.toHaveProperty('textStorageKey');
    });

    it('enqueues a processing job for the uploaded document', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', MINIMAL_PDF, 'queued.pdf')
        .expect(201);

      expect(queue.jobs).toContainEqual({ documentId: response.body.id });
    });

    it('responds 503 and stores nothing when the queue is unavailable', async () => {
      queue.isUnavailable = true;
      const filesBefore = await storedFileCount();
      const listBefore = await request(app.getHttpServer()).get('/documents');

      await request(app.getHttpServer())
        .post('/documents')
        .attach('file', MINIMAL_PDF, 'lost.pdf')
        .expect(503);

      const listAfter = await request(app.getHttpServer()).get('/documents');
      expect(await storedFileCount()).toBe(filesBefore);
      expect(listAfter.body).toEqual(listBefore.body);
    });

    it('accepts a PNG image', async () => {
      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', PNG_SIGNATURE, 'scan.png')
        .expect(201);

      expect(response.body.mimeType).toBe('image/png');
    });

    it('rejects a file whose content is not an allowed type', async () => {
      const filesBefore = await storedFileCount();

      const response = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', Buffer.from('just text'), {
          filename: 'fake.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        path: '/documents',
      });
      expect(await storedFileCount()).toBe(filesBefore);
    });

    it('rejects a request without a file', async () => {
      await request(app.getHttpServer()).post('/documents').expect(400);
    });

    it('rejects a file above the size limit', async () => {
      const oversized = Buffer.concat([MINIMAL_PDF, Buffer.alloc(MEGABYTE)]);

      await request(app.getHttpServer())
        .post('/documents')
        .attach('file', oversized, 'big.pdf')
        .expect(413);
    });
  });

  describe('GET /documents/:id', () => {
    it('returns an uploaded document', async () => {
      const upload = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', MINIMAL_PDF, 'contract.pdf');

      const response = await request(app.getHttpServer())
        .get(`/documents/${upload.body.id}`)
        .expect(200);

      expect(response.body).toEqual(upload.body);
    });

    it('responds 404 for an unknown id', async () => {
      await request(app.getHttpServer())
        .get('/documents/0b8f2c1e-4a8b-4c1d-9e2f-3a4b5c6d7e8f')
        .expect(404);
    });

    it('responds 400 for an id that is not a UUID', async () => {
      await request(app.getHttpServer())
        .get('/documents/not-a-uuid')
        .expect(400);
    });
  });

  describe('GET /documents', () => {
    interface PageBody {
      items: { id: string }[];
      nextCursor: string | null;
    }

    async function getPage(query: string): Promise<PageBody> {
      const response = await request(app.getHttpServer())
        .get(`/documents?${query}`)
        .expect(200);
      return response.body as PageBody;
    }

    it('lists documents newest first, honoring the limit', async () => {
      const latest = await request(app.getHttpServer())
        .post('/documents')
        .attach('file', MINIMAL_PDF, 'latest.pdf');

      const page = await getPage('limit=1');

      expect(page.items).toEqual([latest.body]);
      expect(page.nextCursor).toEqual(expect.any(String));
    });

    it('walks every page with no duplicates or gaps', async () => {
      // Se crean de golpe, así que varios comparten el mismo milisegundo y
      // el orden depende del desempate por id.
      const repository = app.get(DocumentRepository);
      const created = await Promise.all(
        Array.from({ length: 25 }, () =>
          repository.create(buildDocument({ id: randomUUID() })),
        ),
      );

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const query = cursor ? `limit=10&cursor=${cursor}` : 'limit=10';
        const page = await getPage(query);
        expect(page.items.length).toBeLessThanOrEqual(10);
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
      } while (cursor);

      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toEqual(
        expect.arrayContaining(created.map((doc) => doc.id)),
      );
    });

    it('responds 400 for a malformed cursor', async () => {
      await request(app.getHttpServer())
        .get('/documents?cursor=not-a-cursor')
        .expect(400);
    });

    it.each(['0', '101', 'abc'])('rejects limit=%s', async (limit) => {
      await request(app.getHttpServer())
        .get(`/documents?limit=${limit}`)
        .expect(400);
    });
  });
});

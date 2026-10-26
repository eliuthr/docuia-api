import { DocumentStatus } from '../domain/document-status.enum.js';
import { DocumentEventsPublisher } from './document-events.publisher.js';
import { NoopDocumentEventsPublisher } from './noop-document-events.publisher.js';

describe('NoopDocumentEventsPublisher', () => {
  it('accepts events without sending them anywhere', async () => {
    const publisher: DocumentEventsPublisher =
      new NoopDocumentEventsPublisher();

    await expect(
      publisher.publish({ documentId: 'doc-1', status: DocumentStatus.Ready }),
    ).resolves.toBeUndefined();
  });
});

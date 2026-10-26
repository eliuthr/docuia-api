import { parseDocumentJob } from './document-job.js';

describe('parseDocumentJob', () => {
  it('reads the document id from the message body', () => {
    expect(parseDocumentJob('{"documentId":"doc-1"}')).toEqual({
      documentId: 'doc-1',
    });
  });

  it.each(['not json', '{}', '{"documentId":""}', '["doc-1"]'])(
    'returns null for %s',
    (body) => {
      expect(parseDocumentJob(body)).toBeNull();
    },
  );
});

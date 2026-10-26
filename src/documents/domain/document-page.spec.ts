import { buildDocument } from '../../../test/support/build-document.js';
import { toDocumentPage } from './document-page.js';

const documents = ['a', 'b', 'c'].map((id, index) =>
  buildDocument({
    id,
    createdAt: new Date(Date.UTC(2026, 9, 24, 12, 0, 3 - index)),
  }),
);

describe('toDocumentPage', () => {
  it('returns a cursor to the last document when there are more', () => {
    const page = toDocumentPage(documents, 2);

    expect(page.documents.map((document) => document.id)).toEqual(['a', 'b']);
    expect(page.nextCursor).toEqual({
      createdAt: documents[1].createdAt,
      id: 'b',
    });
  });

  it('returns no cursor on the last page', () => {
    const page = toDocumentPage(documents, 3);

    expect(page.documents).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  it('returns no cursor for an empty page', () => {
    expect(toDocumentPage([], 10)).toEqual({ documents: [], nextCursor: null });
  });
});

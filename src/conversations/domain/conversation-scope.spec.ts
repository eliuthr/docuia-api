import {
  COLLECTION_SCOPE,
  documentScope,
  isSameScope,
  scopeDocumentId,
  scopeFromDocumentId,
} from './conversation-scope.js';

describe('conversation scope', () => {
  it('matches the same document', () => {
    expect(isSameScope(documentScope('doc-1'), documentScope('doc-1'))).toBe(
      true,
    );
  });

  it('does not match another document or the collection', () => {
    expect(isSameScope(documentScope('doc-1'), documentScope('doc-2'))).toBe(
      false,
    );
    expect(isSameScope(documentScope('doc-1'), COLLECTION_SCOPE)).toBe(false);
  });

  it('stores the collection as a null document id and reads it back', () => {
    expect(scopeDocumentId(COLLECTION_SCOPE)).toBeNull();
    expect(scopeFromDocumentId(null)).toEqual(COLLECTION_SCOPE);
    expect(scopeFromDocumentId('doc-1')).toEqual(documentScope('doc-1'));
  });
});

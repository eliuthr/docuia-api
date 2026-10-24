import { documentClassificationSchema, DocumentType } from './document-type.js';

describe('documentClassificationSchema', () => {
  it.each(Object.values(DocumentType))('accepts %s', (documentType) => {
    expect(documentClassificationSchema.parse({ documentType })).toEqual({
      documentType,
    });
  });

  it('rejects an unknown document type', () => {
    const result = documentClassificationSchema.safeParse({
      documentType: 'receipt',
    });

    expect(result.success).toBe(false);
  });
});

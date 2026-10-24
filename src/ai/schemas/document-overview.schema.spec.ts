import { documentOverviewSchema } from './document-overview.schema.js';
import { DocumentType } from './document-type.js';

const SUMMARY = 'Factura de Tecnosuministros por 2.638.825 COP.';

describe('documentOverviewSchema', () => {
  it.each(Object.values(DocumentType))('accepts %s', (documentType) => {
    expect(
      documentOverviewSchema.parse({ documentType, summary: SUMMARY }),
    ).toEqual({ documentType, summary: SUMMARY });
  });

  it('rejects an unknown document type', () => {
    const result = documentOverviewSchema.safeParse({
      documentType: 'receipt',
      summary: SUMMARY,
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty summary', () => {
    const result = documentOverviewSchema.safeParse({
      documentType: DocumentType.Other,
      summary: '',
    });

    expect(result.success).toBe(false);
  });
});

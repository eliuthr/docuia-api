import {
  buildDocument,
  buildInvoiceData,
} from '../../../test/support/build-document.js';
import { DocumentType } from '../../ai/schemas/document-type.js';
import { DocumentSearchCriteria } from './document-search-criteria.js';
import { DocumentStatus } from './document-status.enum.js';
import { matchesSearchCriteria } from './matches-search-criteria.js';

const ALL_READY: DocumentSearchCriteria = {
  status: DocumentStatus.Ready,
  documentType: null,
  text: null,
  limit: 10,
};

describe('matchesSearchCriteria', () => {
  it('matches by status and type', () => {
    const invoice = buildDocument();

    expect(matchesSearchCriteria(invoice, ALL_READY)).toBe(true);
    expect(
      matchesSearchCriteria(invoice, {
        ...ALL_READY,
        documentType: DocumentType.Contract,
      }),
    ).toBe(false);
    expect(
      matchesSearchCriteria(
        buildDocument({ status: DocumentStatus.Processing }),
        ALL_READY,
      ),
    ).toBe(false);
  });

  it('finds the text in the vendor name ignoring case and accents', () => {
    const invoice = buildDocument({
      summary: null,
      extractedData: buildInvoiceData({
        vendorName: 'TECNOSUMINISTROS DEL CARIBE',
      }),
    });

    expect(
      matchesSearchCriteria(invoice, {
        ...ALL_READY,
        text: 'tecnosuministros',
      }),
    ).toBe(true);
    expect(
      matchesSearchCriteria(invoice, { ...ALL_READY, text: 'Caríbe' }),
    ).toBe(true);
  });

  it('finds the text in the file name, the summary, contract parties and candidates', () => {
    expect(
      matchesSearchCriteria(buildDocument({ originalName: 'arriendo.pdf' }), {
        ...ALL_READY,
        text: 'ARRIENDO',
      }),
    ).toBe(true);
    expect(
      matchesSearchCriteria(
        buildDocument({
          extractedData: {
            parties: [{ name: 'Ana Gómez', role: null }],
          } as never,
        }),
        { ...ALL_READY, text: 'gomez' },
      ),
    ).toBe(true);
    expect(
      matchesSearchCriteria(
        buildDocument({ extractedData: { fullName: 'Luis Pérez' } as never }),
        { ...ALL_READY, text: 'perez' },
      ),
    ).toBe(true);
  });

  it('does not match text that appears nowhere', () => {
    expect(
      matchesSearchCriteria(buildDocument(), { ...ALL_READY, text: 'ACME' }),
    ).toBe(false);
  });
});

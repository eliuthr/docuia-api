import {
  buildDocument,
  buildInvoiceData,
} from '../../../test/support/build-document.js';
import { DocumentEntity } from '../../documents/domain/document.entity.js';
import { DocumentType } from '../schemas/document-type.js';
import { ReadyDocumentFinder } from './ready-document-finder.js';
import { SumInvoiceTotalsTool } from './sum-invoice-totals.tool.js';

function invoice(
  id: string,
  total: number | null,
  currency: string | null = 'COP',
): DocumentEntity {
  return buildDocument({
    id,
    extractedData: buildInvoiceData({ total, currency }),
  });
}

describe('SumInvoiceTotalsTool', () => {
  let documentsById: Map<string, DocumentEntity>;
  let tool: SumInvoiceTotalsTool;

  beforeEach(() => {
    documentsById = new Map();
    const findById = vi.fn((id: string) =>
      Promise.resolve(documentsById.get(id) ?? null),
    );
    tool = new SumInvoiceTotalsTool({
      findById,
    } as unknown as ReadyDocumentFinder);
  });

  function store(...documents: DocumentEntity[]): void {
    for (const document of documents) {
      documentsById.set(document.id, document);
    }
  }

  it('adds up totals grouped by currency', async () => {
    store(
      invoice('a', 2638825),
      invoice('b', 43000),
      invoice('c', 10.5, 'USD'),
    );

    const result = await tool.execute({ documentIds: ['a', 'b', 'c'] });

    expect(result).toEqual({
      totalsByCurrency: [
        { currency: 'COP', total: 2681825, invoiceCount: 2 },
        { currency: 'USD', total: 10.5, invoiceCount: 1 },
      ],
      notFound: [],
      notInvoices: [],
      withoutTotal: [],
    });
  });

  it('rounds to cents to avoid floating point errors', async () => {
    store(invoice('a', 0.1, 'USD'), invoice('b', 0.2, 'USD'));

    const result = await tool.execute({ documentIds: ['a', 'b'] });

    expect(result).toMatchObject({
      totalsByCurrency: [{ currency: 'USD', total: 0.3, invoiceCount: 2 }],
    });
  });

  it('counts each invoice once even if its id is repeated', async () => {
    store(invoice('a', 100));

    const result = await tool.execute({ documentIds: ['a', 'a'] });

    expect(result).toMatchObject({
      totalsByCurrency: [{ currency: 'COP', total: 100, invoiceCount: 1 }],
    });
  });

  it('reports ids that are missing, not invoices or without a total', async () => {
    store(
      invoice('no-total', null),
      invoice('no-currency', 50, null),
      buildDocument({
        id: 'contract',
        documentType: DocumentType.Contract,
      }),
    );

    const result = await tool.execute({
      documentIds: ['missing', 'contract', 'no-total', 'no-currency'],
    });

    expect(result).toEqual({
      totalsByCurrency: [{ currency: 'UNKNOWN', total: 50, invoiceCount: 1 }],
      notFound: ['missing'],
      notInvoices: ['contract'],
      withoutTotal: ['no-total'],
    });
  });

  it('rejects an empty list of ids', () => {
    expect(tool.inputSchema.safeParse({ documentIds: [] }).success).toBe(false);
  });
});

import { buildDocument } from '../../../test/support/build-document.js';
import { DocumentStatus } from '../../documents/domain/document-status.enum.js';
import { DocumentRepository } from '../../documents/repositories/document.repository.js';
import { DocumentType } from '../schemas/document-type.js';
import { FindDocumentsTool } from './find-documents.tool.js';

describe('FindDocumentsTool', () => {
  let search: ReturnType<typeof vi.fn>;
  let tool: FindDocumentsTool;

  beforeEach(() => {
    search = vi.fn().mockResolvedValue([buildDocument()]);
    tool = new FindDocumentsTool({ search } as unknown as DocumentRepository);
  });

  it('searches only ready documents with the given filters', async () => {
    await tool.execute({
      documentType: DocumentType.Invoice,
      text: 'Tecno',
      limit: 5,
    });

    expect(search).toHaveBeenCalledWith({
      status: DocumentStatus.Ready,
      documentType: DocumentType.Invoice,
      text: 'Tecno',
      limit: 5,
    });
  });

  it('returns a short card with the key fields of each document', async () => {
    const result = await tool.execute({
      documentType: null,
      text: null,
      limit: 5,
    });

    expect(result).toEqual({
      count: 1,
      documents: [
        {
          id: 'doc-1',
          name: 'factura.pdf',
          documentType: 'invoice',
          uploadedAt: new Date('2026-10-24T12:00:00.000Z'),
          summary: 'Factura de Tecnosuministros.',
          keyFields: {
            vendorName: 'Tecnosuministros del Caribe S.A.S.',
            invoiceNumber: 'FEV-1',
            issueDate: '2026-10-14',
            total: 1000,
            currency: 'COP',
          },
        },
      ],
    });
  });

  it('rejects a limit above the maximum', () => {
    const result = tool.inputSchema.safeParse({
      documentType: null,
      text: null,
      limit: 500,
    });

    expect(result.success).toBe(false);
  });
});

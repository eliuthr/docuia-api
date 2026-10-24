import { buildDocument } from '../../../test/support/build-document.js';
import { GetDocumentDetailsTool } from './get-document-details.tool.js';
import {
  DOCUMENT_NOT_FOUND_RESULT,
  ReadyDocumentFinder,
} from './ready-document-finder.js';

describe('GetDocumentDetailsTool', () => {
  let findById: ReturnType<typeof vi.fn>;
  let tool: GetDocumentDetailsTool;

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue(buildDocument());
    tool = new GetDocumentDetailsTool({
      findById,
    } as unknown as ReadyDocumentFinder);
  });

  it('returns the summary and extracted data without internal fields', async () => {
    const document = buildDocument();

    await expect(tool.execute({ documentId: 'doc-1' })).resolves.toEqual({
      id: 'doc-1',
      name: 'factura.pdf',
      documentType: 'invoice',
      pageCount: 1,
      summary: document.summary,
      extractedData: document.extractedData,
    });
  });

  it('reports a missing document', async () => {
    findById.mockResolvedValue(null);

    await expect(tool.execute({ documentId: 'doc-9' })).resolves.toBe(
      DOCUMENT_NOT_FOUND_RESULT,
    );
  });

  it('rejects input without a document id', () => {
    expect(tool.inputSchema.safeParse({}).success).toBe(false);
  });
});

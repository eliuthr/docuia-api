import { Logger } from '@nestjs/common';
import { DocumentType } from '../schemas/document-type.js';
import { DocumentAnalyzerService } from './document-analyzer.service.js';
import { DocumentDataExtractorService } from './document-data-extractor.service.js';
import { DocumentOverviewService } from './document-overview.service.js';

const INPUT = { kind: 'text', text: 'Factura FE-1' } as const;
const INVOICE_DATA = { invoiceNumber: 'FE-1' };
const SUMMARY = 'Factura FE-1.';

describe('DocumentAnalyzerService', () => {
  let describeDocument: ReturnType<typeof vi.fn>;
  let extract: ReturnType<typeof vi.fn>;
  let analyzer: DocumentAnalyzerService;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    describeDocument = vi.fn().mockResolvedValue({
      documentType: DocumentType.Invoice,
      summary: SUMMARY,
    });
    extract = vi.fn().mockResolvedValue(INVOICE_DATA);
    analyzer = new DocumentAnalyzerService(
      { describe: describeDocument } as unknown as DocumentOverviewService,
      { extract } as unknown as DocumentDataExtractorService,
    );
  });

  it('describes the document and extracts the data for its type', async () => {
    await expect(analyzer.analyze('doc-1', INPUT)).resolves.toEqual({
      documentType: DocumentType.Invoice,
      summary: SUMMARY,
      extractedData: INVOICE_DATA,
    });
    expect(extract).toHaveBeenCalledWith('doc-1', DocumentType.Invoice, INPUT);
  });

  it('skips extraction for documents classified as other', async () => {
    describeDocument.mockResolvedValue({
      documentType: DocumentType.Other,
      summary: SUMMARY,
    });

    await expect(analyzer.analyze('doc-1', INPUT)).resolves.toEqual({
      documentType: DocumentType.Other,
      summary: SUMMARY,
      extractedData: null,
    });
    expect(extract).not.toHaveBeenCalled();
  });
});

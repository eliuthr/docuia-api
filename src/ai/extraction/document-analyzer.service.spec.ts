import { Logger } from '@nestjs/common';
import { DocumentType } from '../schemas/document-type.js';
import { DocumentAnalyzerService } from './document-analyzer.service.js';
import { DocumentClassifierService } from './document-classifier.service.js';
import { DocumentDataExtractorService } from './document-data-extractor.service.js';

const INPUT = { kind: 'text', text: 'Factura FE-1' } as const;
const INVOICE_DATA = { invoiceNumber: 'FE-1' };

describe('DocumentAnalyzerService', () => {
  let classify: ReturnType<typeof vi.fn>;
  let extract: ReturnType<typeof vi.fn>;
  let analyzer: DocumentAnalyzerService;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    classify = vi.fn().mockResolvedValue(DocumentType.Invoice);
    extract = vi.fn().mockResolvedValue(INVOICE_DATA);
    analyzer = new DocumentAnalyzerService(
      { classify } as unknown as DocumentClassifierService,
      { extract } as unknown as DocumentDataExtractorService,
    );
  });

  it('classifies the document and extracts the data for its type', async () => {
    await expect(analyzer.analyze('doc-1', INPUT)).resolves.toEqual({
      documentType: DocumentType.Invoice,
      extractedData: INVOICE_DATA,
    });
    expect(extract).toHaveBeenCalledWith('doc-1', DocumentType.Invoice, INPUT);
  });

  it('skips extraction for documents classified as other', async () => {
    classify.mockResolvedValue(DocumentType.Other);

    await expect(analyzer.analyze('doc-1', INPUT)).resolves.toEqual({
      documentType: DocumentType.Other,
      extractedData: null,
    });
    expect(extract).not.toHaveBeenCalled();
  });
});

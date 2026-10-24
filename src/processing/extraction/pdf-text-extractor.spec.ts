import { readFile } from 'node:fs/promises';
import { UnreadableDocumentError } from '../errors/unreadable-document.error.js';
import { PdfTextExtractor } from './pdf-text-extractor.js';

const FIXTURE_PDF = new URL(
  '../../../test/fixtures/invoice.pdf',
  import.meta.url,
);

describe('PdfTextExtractor', () => {
  const extractor = new PdfTextExtractor();

  it('extracts the text and page count of a PDF', async () => {
    const result = await extractor.extract(await readFile(FIXTURE_PDF));

    expect(result.pageCount).toBe(2);
    expect(result.text).toContain('Invoice 001 ACME Corp');
    expect(result.text).toContain('Total 150.00 USD');
  });

  it('reports a corrupt file as unreadable', async () => {
    const corrupt = Buffer.from('%PDF-1.4 not really a pdf');

    await expect(extractor.extract(corrupt)).rejects.toBeInstanceOf(
      UnreadableDocumentError,
    );
  });
});

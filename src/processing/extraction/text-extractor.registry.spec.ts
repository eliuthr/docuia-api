import { PdfTextExtractor } from './pdf-text-extractor.js';
import { TextExtractorRegistry } from './text-extractor.registry.js';

describe('TextExtractorRegistry', () => {
  const pdfExtractor = new PdfTextExtractor();
  const registry = new TextExtractorRegistry(pdfExtractor);

  it('returns the PDF extractor for PDFs', () => {
    expect(registry.forMimeType('application/pdf')).toBe(pdfExtractor);
  });

  it.each(['image/png', 'image/jpeg'])('returns null for %s', (mimeType) => {
    expect(registry.forMimeType(mimeType)).toBeNull();
  });
});

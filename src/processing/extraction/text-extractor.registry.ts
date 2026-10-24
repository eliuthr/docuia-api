import { Injectable } from '@nestjs/common';
import { PdfTextExtractor } from './pdf-text-extractor.js';
import { TextExtractor } from './text-extractor.js';

/**
 * Elige el extractor según el tipo MIME. Los tipos sin extractor (imágenes)
 * devuelven null: los leerá un modelo con visión en una etapa posterior.
 */
@Injectable()
export class TextExtractorRegistry {
  private readonly extractorsByMimeType: ReadonlyMap<string, TextExtractor>;

  constructor(pdfExtractor: PdfTextExtractor) {
    this.extractorsByMimeType = new Map([['application/pdf', pdfExtractor]]);
  }

  forMimeType(mimeType: string): TextExtractor | null {
    return this.extractorsByMimeType.get(mimeType) ?? null;
  }
}

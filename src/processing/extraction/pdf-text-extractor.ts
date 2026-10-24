import { Injectable } from '@nestjs/common';
import { extractText, getDocumentProxy } from 'unpdf';
import { UnreadableDocumentError } from '../errors/unreadable-document.error.js';
import { ExtractedText, TextExtractor } from './text-extractor.js';

/** Nivel de log de PDF.js que solo reporta errores, para mantener limpios los logs del worker. */
const PDFJS_ERRORS_ONLY = 0;

@Injectable()
export class PdfTextExtractor extends TextExtractor {
  async extract(content: Buffer): Promise<ExtractedText> {
    try {
      // PDF.js puede quedarse con los bytes, así que recibe una copia.
      const pdf = await getDocumentProxy(new Uint8Array(content), {
        verbosity: PDFJS_ERRORS_ONLY,
      });
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      return { text, pageCount: totalPages };
    } catch (error) {
      throw new UnreadableDocumentError(
        'The PDF file is corrupt or cannot be read.',
        { cause: error },
      );
    }
  }
}

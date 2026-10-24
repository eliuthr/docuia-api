export interface ExtractedText {
  text: string;
  pageCount: number;
}

/** Extrae texto plano de un tipo de archivo. */
export abstract class TextExtractor {
  /** @throws UnreadableDocumentError cuando el contenido no se puede interpretar. */
  abstract extract(content: Buffer): Promise<ExtractedText>;
}

import { DocumentEntity } from './document.entity.js';

/**
 * Clave de orden del último documento de una página: la siguiente página
 * empieza justo después de ella (paginación por cursor o "keyset").
 */
export interface DocumentPageCursor {
  createdAt: Date;
  id: string;
}

export interface DocumentPageRequest {
  limit: number;
  /** null para la primera página. */
  after: DocumentPageCursor | null;
}

export interface DocumentPage {
  documents: DocumentEntity[];
  /** null cuando no hay más documentos. */
  nextCursor: DocumentPageCursor | null;
}

/**
 * Arma la página a partir de hasta `limit + 1` documentos ya ordenados: si
 * llegó el documento extra, hay una página siguiente y el cursor apunta al
 * último documento que sí se devuelve.
 */
export function toDocumentPage(
  sortedDocuments: DocumentEntity[],
  limit: number,
): DocumentPage {
  const documents = sortedDocuments.slice(0, limit);
  const last = documents.at(-1);
  const hasMore = sortedDocuments.length > limit && last !== undefined;
  return {
    documents,
    nextCursor: hasMore ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

import { QueryFilter } from 'mongoose';
import { DocumentPageCursor } from '../domain/document-page.js';
import { DocumentRecord } from '../schemas/document-record.schema.js';

/** Orden de la lista; el `_id` desempata documentos creados en el mismo milisegundo. */
export const PAGE_SORT = { createdAt: -1, _id: -1 } as const;

/** Documentos que van después del cursor en el orden `PAGE_SORT`. */
export function buildCursorFilter(
  after: DocumentPageCursor | null,
): QueryFilter<DocumentRecord> {
  if (!after) {
    return {};
  }
  return {
    $or: [
      { createdAt: { $lt: after.createdAt } },
      { createdAt: after.createdAt, _id: { $lt: after.id } },
    ],
  };
}

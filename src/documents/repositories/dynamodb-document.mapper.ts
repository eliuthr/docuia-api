import { DocumentPageCursor } from '../domain/document-page.js';
import { DocumentEntity } from '../domain/document.entity.js';

/** Índice secundario (GSI) que ordena todos los documentos por fecha de creación. */
export const DOCUMENTS_BY_CREATED_AT_INDEX = 'byCreatedAt';
/** Todos los documentos comparten esta partición del índice, así la lista sale ordenada. */
export const DOCUMENT_LIST_KEY = 'DOCUMENT';

/** Un documento como se guarda en DynamoDB: fechas en ISO y las claves del índice. */
export type DocumentItem = Omit<DocumentEntity, 'createdAt' | 'updatedAt'> & {
  listKey: typeof DOCUMENT_LIST_KEY;
  createdAtId: string;
  createdAt: string;
  updatedAt: string;
};

/** Clave de orden del índice: las fechas ISO se ordenan bien como texto. */
export function createdAtIdOf(cursor: DocumentPageCursor): string {
  return `${cursor.createdAt.toISOString()}#${cursor.id}`;
}

export function toDocumentItem(document: DocumentEntity): DocumentItem {
  return {
    ...document,
    listKey: DOCUMENT_LIST_KEY,
    createdAtId: createdAtIdOf(document),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

/** Los campos que DynamoDB omite al estar vacíos vuelven como null, como en Mongo. */
export function toDocumentEntity(item: DocumentItem): DocumentEntity {
  const { listKey: _listKey, createdAtId: _createdAtId, ...fields } = item;
  return {
    ...fields,
    textStorageKey: fields.textStorageKey ?? null,
    pageCount: fields.pageCount ?? null,
    failureReason: fields.failureReason ?? null,
    documentType: fields.documentType ?? null,
    summary: fields.summary ?? null,
    extractedData: fields.extractedData ?? null,
    createdAt: new Date(fields.createdAt),
    updatedAt: new Date(fields.updatedAt),
  };
}

/** `ExclusiveStartKey` de la consulta: las claves de la tabla y del índice del cursor. */
export function startKeyOf(cursor: DocumentPageCursor): Record<string, string> {
  return {
    id: cursor.id,
    listKey: DOCUMENT_LIST_KEY,
    createdAtId: createdAtIdOf(cursor),
  };
}

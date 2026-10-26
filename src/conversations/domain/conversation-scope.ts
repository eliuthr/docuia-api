/** A qué pertenece una conversación: un documento o la colección completa. */
export type ConversationScope =
  { kind: 'document'; documentId: string } | { kind: 'collection' };

export const COLLECTION_SCOPE: ConversationScope = { kind: 'collection' };

export function documentScope(documentId: string): ConversationScope {
  return { kind: 'document', documentId };
}

export function isSameScope(
  first: ConversationScope,
  second: ConversationScope,
): boolean {
  return scopeDocumentId(first) === scopeDocumentId(second);
}

/** Forma en que se guarda el alcance: el id del documento, o null para la colección. */
export function scopeDocumentId(scope: ConversationScope): string | null {
  return scope.kind === 'document' ? scope.documentId : null;
}

export function scopeFromDocumentId(
  documentId: string | null,
): ConversationScope {
  return documentId === null ? COLLECTION_SCOPE : documentScope(documentId);
}

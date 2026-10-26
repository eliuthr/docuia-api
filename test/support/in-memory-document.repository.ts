import { Module } from '@nestjs/common';
import {
  DocumentChanges,
  DocumentEntity,
  NewDocument,
} from '../../src/documents/domain/document.entity.js';
import {
  DocumentPage,
  DocumentPageCursor,
  DocumentPageRequest,
  toDocumentPage,
} from '../../src/documents/domain/document-page.js';
import { DocumentSearchCriteria } from '../../src/documents/domain/document-search-criteria.js';
import { matchesSearchCriteria } from '../../src/documents/domain/matches-search-criteria.js';
import { DocumentRepository } from '../../src/documents/repositories/document.repository.js';

export class InMemoryDocumentRepository extends DocumentRepository {
  private readonly documents = new Map<string, DocumentEntity>();

  create(document: NewDocument): Promise<DocumentEntity> {
    const now = new Date();
    const entity = { ...document, createdAt: now, updatedAt: now };
    this.documents.set(entity.id, entity);
    return Promise.resolve(entity);
  }

  findById(id: string): Promise<DocumentEntity | null> {
    return Promise.resolve(this.documents.get(id) ?? null);
  }

  findPage(request: DocumentPageRequest): Promise<DocumentPage> {
    const sorted = [...this.documents.values()]
      .sort(newestFirst)
      .filter((document) => isAfter(document, request.after));
    return Promise.resolve(
      toDocumentPage(sorted.slice(0, request.limit + 1), request.limit),
    );
  }

  search(criteria: DocumentSearchCriteria): Promise<DocumentEntity[]> {
    const matches = [...this.documents.values()]
      .reverse()
      .filter((document) => matchesSearchCriteria(document, criteria));
    return Promise.resolve(matches.slice(0, criteria.limit));
  }

  update(id: string, changes: DocumentChanges): Promise<DocumentEntity | null> {
    const current = this.documents.get(id);
    if (!current) {
      return Promise.resolve(null);
    }
    const updated = { ...current, ...changes, updatedAt: new Date() };
    this.documents.set(id, updated);
    return Promise.resolve(updated);
  }

  delete(id: string): Promise<void> {
    this.documents.delete(id);
    return Promise.resolve();
  }
}

/**
 * Mismo orden que Mongo: createdAt descendente y, si empatan, id descendente.
 * Negativo si `first` va antes que `second`.
 */
function newestFirst(
  first: DocumentPageCursor,
  second: DocumentPageCursor,
): number {
  const byDate = second.createdAt.getTime() - first.createdAt.getTime();
  return byDate !== 0 ? byDate : second.id.localeCompare(first.id);
}

/** true si el documento va después del cursor en ese orden. */
function isAfter(
  document: DocumentEntity,
  cursor: DocumentPageCursor | null,
): boolean {
  return cursor === null || newestFirst(cursor, document) < 0;
}

@Module({
  providers: [
    { provide: DocumentRepository, useClass: InMemoryDocumentRepository },
  ],
  exports: [DocumentRepository],
})
export class InMemoryDocumentPersistenceModule {}

/** Reemplaza los módulos que necesitan una conexión real a la base de datos. */
@Module({})
export class NoDatabaseModule {}

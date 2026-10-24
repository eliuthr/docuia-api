import { Module } from '@nestjs/common';
import {
  DocumentChanges,
  DocumentEntity,
  NewDocument,
} from '../../src/documents/domain/document.entity.js';
import { DocumentSearchCriteria } from '../../src/documents/domain/document-search-criteria.js';
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

  findRecent(limit: number): Promise<DocumentEntity[]> {
    const newestFirst = [...this.documents.values()].reverse();
    return Promise.resolve(newestFirst.slice(0, limit));
  }

  search(criteria: DocumentSearchCriteria): Promise<DocumentEntity[]> {
    const matches = [...this.documents.values()]
      .reverse()
      .filter((document) => matchesCriteria(document, criteria));
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

/** Versión simplificada del filtro de Mongo: busca el texto en todo el documento. */
function matchesCriteria(
  document: DocumentEntity,
  criteria: DocumentSearchCriteria,
): boolean {
  if (document.status !== criteria.status) {
    return false;
  }
  if (
    criteria.documentType &&
    document.documentType !== criteria.documentType
  ) {
    return false;
  }
  if (!criteria.text) {
    return true;
  }
  const searchable = JSON.stringify([
    document.originalName,
    document.summary,
    document.extractedData,
  ]).toLowerCase();
  return searchable.includes(criteria.text.toLowerCase());
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

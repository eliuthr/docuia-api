import { Module } from '@nestjs/common';
import {
  DocumentEntity,
  NewDocument,
} from '../../src/documents/domain/document.entity.js';
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
}

@Module({
  providers: [
    { provide: DocumentRepository, useClass: InMemoryDocumentRepository },
  ],
  exports: [DocumentRepository],
})
export class InMemoryDocumentPersistenceModule {}

/** Replaces modules that need a live database connection. */
@Module({})
export class NoDatabaseModule {}

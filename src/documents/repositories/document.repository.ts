import { DocumentEntity, NewDocument } from '../domain/document.entity.js';

/**
 * Persistence port for documents. Abstract class instead of interface so Nest
 * can use it as an injection token.
 */
export abstract class DocumentRepository {
  abstract create(document: NewDocument): Promise<DocumentEntity>;
  abstract findById(id: string): Promise<DocumentEntity | null>;
  abstract findRecent(limit: number): Promise<DocumentEntity[]>;
}

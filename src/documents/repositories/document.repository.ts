import {
  DocumentChanges,
  DocumentEntity,
  NewDocument,
} from '../domain/document.entity.js';
import { DocumentPage, DocumentPageRequest } from '../domain/document-page.js';
import { DocumentSearchCriteria } from '../domain/document-search-criteria.js';

/**
 * Puerto de persistencia de documentos. Es una clase abstracta y no una
 * interfaz para que Nest pueda usarla como token de inyección.
 */
export abstract class DocumentRepository {
  abstract create(document: NewDocument): Promise<DocumentEntity>;
  abstract findById(id: string): Promise<DocumentEntity | null>;
  /** Una página de documentos, del más reciente al más antiguo (paginación por cursor). */
  abstract findPage(request: DocumentPageRequest): Promise<DocumentPage>;
  /** Documentos que cumplen los criterios, del más reciente al más antiguo. */
  abstract search(criteria: DocumentSearchCriteria): Promise<DocumentEntity[]>;
  /** Devuelve el documento actualizado, o null si no existe. */
  abstract update(
    id: string,
    changes: DocumentChanges,
  ): Promise<DocumentEntity | null>;
  abstract delete(id: string): Promise<void>;
}

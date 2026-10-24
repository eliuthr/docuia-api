import { Injectable } from '@nestjs/common';
import { DocumentStatus } from '../../documents/domain/document-status.enum.js';
import { DocumentEntity } from '../../documents/domain/document.entity.js';
import { DocumentRepository } from '../../documents/repositories/document.repository.js';

export const DOCUMENT_NOT_FOUND_RESULT = {
  error: 'Document not found or not processed yet.',
} as const;

/** Las herramientas solo ven documentos listos: los demás no tienen datos confiables. */
@Injectable()
export class ReadyDocumentFinder {
  constructor(private readonly repository: DocumentRepository) {}

  async findById(documentId: string): Promise<DocumentEntity | null> {
    const document = await this.repository.findById(documentId);
    return document?.status === DocumentStatus.Ready ? document : null;
  }
}

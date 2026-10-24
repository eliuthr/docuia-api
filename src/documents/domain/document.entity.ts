import { DocumentType } from '../../ai/schemas/document-type.js';
import { ExtractedData } from '../../ai/schemas/extracted-data.js';
import { DocumentStatus } from './document-status.enum.js';

export interface DocumentEntity {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  status: DocumentStatus;
  textStorageKey: string | null;
  pageCount: number | null;
  failureReason: string | null;
  documentType: DocumentType | null;
  summary: string | null;
  extractedData: ExtractedData | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewDocument = Omit<DocumentEntity, 'createdAt' | 'updatedAt'>;

/** Campos que el procesamiento puede cambiar después de crear el documento. */
export type DocumentChanges = Partial<
  Pick<
    DocumentEntity,
    | 'status'
    | 'textStorageKey'
    | 'pageCount'
    | 'failureReason'
    | 'documentType'
    | 'summary'
    | 'extractedData'
  >
>;

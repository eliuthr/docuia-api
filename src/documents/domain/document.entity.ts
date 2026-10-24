import { DocumentStatus } from './document-status.enum.js';

export interface DocumentEntity {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type NewDocument = Omit<DocumentEntity, 'createdAt' | 'updatedAt'>;

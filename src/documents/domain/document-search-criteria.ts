import { DocumentType } from '../../ai/schemas/document-type.js';
import { DocumentStatus } from './document-status.enum.js';

export interface DocumentSearchCriteria {
  status: DocumentStatus;
  documentType: DocumentType | null;
  /**
   * Texto a buscar, sin distinguir mayúsculas, en el nombre del archivo, el
   * resumen y los nombres de los datos extraídos (proveedor, partes, candidato).
   */
  text: string | null;
  limit: number;
}

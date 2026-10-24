/**
 * La parte de un archivo de Multer que usa el módulo de documentos, para que
 * los services no dependan de la librería de subida HTTP.
 */
export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

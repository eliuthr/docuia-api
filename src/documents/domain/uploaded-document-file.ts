/**
 * The subset of a Multer file the documents feature relies on, so services do
 * not depend on the HTTP upload library.
 */
export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

import { PermanentProcessingError } from './permanent-processing.error.js';

/** El archivo en sí no se puede leer (contenido corrupto o no soportado). */
export class UnreadableDocumentError extends PermanentProcessingError {
  override readonly name = 'UnreadableDocumentError';
}

import { PermanentProcessingError } from './permanent-processing.error.js';

/**
 * El LLM no pudo extraer los datos: respondió dos veces algo inválido o se
 * agotó el saldo. La causa interna queda en `cause` para los logs.
 */
export class DataExtractionFailedError extends PermanentProcessingError {
  override readonly name = 'DataExtractionFailedError';

  constructor(cause: Error) {
    super('The document data could not be extracted. Try again later.', {
      cause,
    });
  }
}

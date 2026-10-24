/**
 * El archivo en sí no se puede leer (contenido corrupto o no soportado).
 * Reintentar da el mismo resultado, así que el trabajo falla de inmediato.
 * El mensaje se muestra a los clientes, así que no debe tener detalles internos.
 */
export class UnreadableDocumentError extends Error {
  override readonly name = 'UnreadableDocumentError';
}

export const GENERIC_FAILURE_REASON =
  'Processing failed. Try uploading the file again.';

/** Mensaje seguro de guardar y devolver a los clientes cuando falla el procesamiento. */
export function failureReasonFor(error: unknown): string {
  return error instanceof UnreadableDocumentError
    ? error.message
    : GENERIC_FAILURE_REASON;
}

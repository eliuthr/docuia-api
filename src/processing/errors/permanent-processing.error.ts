/**
 * Error que no se arregla reintentando, así que el trabajo falla de inmediato.
 * El mensaje se muestra a los clientes, así que no debe tener detalles internos.
 */
export abstract class PermanentProcessingError extends Error {}

export const GENERIC_FAILURE_REASON =
  'Processing failed. Try uploading the file again.';

/** Mensaje seguro de guardar y devolver a los clientes cuando falla el procesamiento. */
export function failureReasonFor(error: unknown): string {
  return error instanceof PermanentProcessingError
    ? error.message
    : GENERIC_FAILURE_REASON;
}

import { DocumentJob } from './document-job.js';

/**
 * Programa el procesamiento de documentos. Es una clase abstracta y no una
 * interfaz para que Nest pueda usarla como token de inyección.
 */
export abstract class QueueProvider {
  abstract enqueue(job: DocumentJob): Promise<void>;
}

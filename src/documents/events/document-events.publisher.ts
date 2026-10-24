import { DocumentStatusEvent } from './document-status-event.js';

/**
 * Publica cambios de estado de los documentos. Es una clase abstracta y no una
 * interfaz para que Nest pueda usarla como token de inyección.
 */
export abstract class DocumentEventsPublisher {
  /** Nunca falla: los eventos son una ayuda, la base de datos sigue siendo la fuente de verdad. */
  abstract publish(event: DocumentStatusEvent): Promise<void>;
}

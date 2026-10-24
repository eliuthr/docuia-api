import { z } from 'zod';
import { DocumentStatus } from '../domain/document-status.enum.js';

/** Canal de Redis por el que el worker avisa los cambios de estado. */
export const DOCUMENT_EVENTS_CHANNEL = 'docuia:document-events';

/** Token del cliente de Redis que usa cada módulo de eventos (una conexión propia). */
export const EVENTS_REDIS_CLIENT = Symbol('EVENTS_REDIS_CLIENT');

export const documentStatusEventSchema = z.object({
  documentId: z.string().min(1),
  status: z.enum(DocumentStatus),
});

export type DocumentStatusEvent = z.infer<typeof documentStatusEventSchema>;

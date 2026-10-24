import { z } from 'zod';
import { DocumentType } from './document-type.js';

/** Resultado del primer paso del análisis: tipo de documento y resumen corto. */
export const documentOverviewSchema = z.object({
  documentType: z.enum(DocumentType),
  summary: z.string().min(1),
});

export type DocumentOverview = z.infer<typeof documentOverviewSchema>;

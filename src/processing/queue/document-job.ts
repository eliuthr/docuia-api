import { z } from 'zod';
import { parseJson } from '../../common/json/parse-json.js';

export const DOCUMENT_PROCESSING_QUEUE = 'document-processing';
export const PROCESS_DOCUMENT_JOB = 'process-document';

const documentJobSchema = z.object({ documentId: z.string().min(1) });

export type DocumentJob = z.infer<typeof documentJobSchema>;

/** Lee el cuerpo de un mensaje de la cola; null si no es un trabajo válido. */
export function parseDocumentJob(body: string): DocumentJob | null {
  const result = documentJobSchema.safeParse(parseJson(body));
  return result.success ? result.data : null;
}

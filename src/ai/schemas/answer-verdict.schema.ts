import { z } from 'zod';

/** Resultado de revisar el borrador de la respuesta contra los resultados de las herramientas. */
export const answerVerdictSchema = z.object({
  verdict: z.enum(['supported', 'unsupported']),
  /** Qué hay que corregir; vacío cuando la respuesta está respaldada. */
  feedback: z.string(),
});

export type AnswerVerdict = z.infer<typeof answerVerdictSchema>;

import { z } from 'zod';
import { QuestionCategory } from '../agent/question-category.js';

export const questionClassificationSchema = z.object({
  category: z.enum(QuestionCategory),
});

export type QuestionClassification = z.infer<
  typeof questionClassificationSchema
>;

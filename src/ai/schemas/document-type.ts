import { z } from 'zod';

export enum DocumentType {
  Invoice = 'invoice',
  Contract = 'contract',
  Resume = 'resume',
  Other = 'other',
}

export const documentClassificationSchema = z.object({
  documentType: z.enum(DocumentType),
});

export type DocumentClassification = z.infer<
  typeof documentClassificationSchema
>;

import { z } from 'zod';
import {
  nullableAmount,
  nullableCurrencyCode,
  nullableIsoDate,
  nullableText,
} from './schema-fields.js';

const contractPartySchema = z.object({
  name: z.string(),
  role: nullableText,
});

export const contractSchema = z.object({
  title: nullableText,
  parties: z.array(contractPartySchema),
  effectiveDate: nullableIsoDate,
  expirationDate: nullableIsoDate,
  value: nullableAmount,
  currency: nullableCurrencyCode,
  governingLaw: nullableText,
  summary: nullableText,
});

export type ContractData = z.infer<typeof contractSchema>;

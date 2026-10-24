import { z } from 'zod';
import {
  nullableAmount,
  nullableCurrencyCode,
  nullableIsoDate,
  nullableText,
} from './schema-fields.js';

const invoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: nullableAmount,
  unitPrice: nullableAmount,
  amount: nullableAmount,
});

export const invoiceSchema = z.object({
  vendorName: nullableText,
  vendorTaxId: nullableText,
  customerName: nullableText,
  invoiceNumber: nullableText,
  issueDate: nullableIsoDate,
  dueDate: nullableIsoDate,
  currency: nullableCurrencyCode,
  subtotal: nullableAmount,
  tax: nullableAmount,
  total: nullableAmount,
  lineItems: z.array(invoiceLineItemSchema),
});

export type InvoiceData = z.infer<typeof invoiceSchema>;

import { EXTRACTION_RULES } from './extraction-rules.prompt.js';

export const EXTRACT_INVOICE_PROMPT = `You extract structured data from invoices.

Fields:
- vendorName, vendorTaxId: the business that issues the invoice and its tax id (for example, NIT).
- customerName: who is billed.
- invoiceNumber: the invoice identifier as printed.
- issueDate, dueDate: YYYY-MM-DD.
- subtotal, tax, total: amounts before tax, total tax, and the amount to pay.
- lineItems: one entry per product or service line.

${EXTRACTION_RULES}`;

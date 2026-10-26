import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DocumentEntity } from '../../documents/domain/document.entity.js';
import { DocumentType } from '../schemas/document-type.js';
import { InvoiceData } from '../schemas/invoice.schema.js';
import { LlmTool } from './llm-tool.js';
import { ReadyDocumentFinder } from './ready-document-finder.js';
import { ToolName } from './tool-name.js';

const MAX_INVOICES = 50;
const UNKNOWN_CURRENCY = 'UNKNOWN';
/** Se redondea a centavos para evitar errores de punto flotante (0.1 + 0.2). */
const CENTS = 100;

const inputSchema = z.object({
  documentIds: z.array(z.string()).min(1).max(MAX_INVOICES),
});

type SumInvoiceTotalsInput = z.infer<typeof inputSchema>;

interface CurrencyTotal {
  currency: string;
  total: number;
  invoiceCount: number;
}

@Injectable()
export class SumInvoiceTotalsTool implements LlmTool<SumInvoiceTotalsInput> {
  readonly name = ToolName.SumInvoiceTotals;
  readonly description =
    'Adds up the totals of the given invoices, grouped by currency. Always use it instead ' +
    'of adding numbers yourself. It also lists ids that were not found, are not invoices ' +
    'or have no total, so you can mention them.';
  readonly inputSchema = inputSchema;

  constructor(private readonly documents: ReadyDocumentFinder) {}

  async execute({ documentIds }: SumInvoiceTotalsInput): Promise<unknown> {
    const uniqueIds = [...new Set(documentIds)];
    const found = await Promise.all(
      uniqueIds.map((id) => this.documents.findById(id)),
    );
    const notFound = uniqueIds.filter((_id, index) => !found[index]);
    const existing = found.filter((document) => document !== null);
    const invoices = existing.filter(isInvoice);
    const withTotal = invoices.filter((invoice) => totalOf(invoice) !== null);

    return {
      totalsByCurrency: sumByCurrency(withTotal),
      notFound,
      notInvoices: idsOf(existing.filter((document) => !isInvoice(document))),
      withoutTotal: idsOf(
        invoices.filter((invoice) => totalOf(invoice) === null),
      ),
    };
  }
}

function sumByCurrency(invoices: DocumentEntity[]): CurrencyTotal[] {
  const totals = new Map<string, CurrencyTotal>();
  for (const invoice of invoices) {
    const data = invoice.extractedData as InvoiceData;
    const currency = data.currency ?? UNKNOWN_CURRENCY;
    const current = totals.get(currency) ?? {
      currency,
      total: 0,
      invoiceCount: 0,
    };
    current.total = roundToCents(current.total + (data.total ?? 0));
    current.invoiceCount += 1;
    totals.set(currency, current);
  }
  return [...totals.values()];
}

function isInvoice(document: DocumentEntity): boolean {
  return (
    document.documentType === DocumentType.Invoice &&
    document.extractedData !== null
  );
}

function totalOf(invoice: DocumentEntity): number | null {
  return (invoice.extractedData as InvoiceData).total;
}

function idsOf(documents: DocumentEntity[]): string[] {
  return documents.map((document) => document.id);
}

function roundToCents(amount: number): number {
  return Math.round(amount * CENTS) / CENTS;
}

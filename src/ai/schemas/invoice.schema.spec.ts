import { invoiceSchema } from './invoice.schema.js';

const validInvoice = {
  vendorName: 'Papelería El Centro',
  vendorTaxId: '900123456-7',
  customerName: null,
  invoiceNumber: 'FE-1024',
  issueDate: '2026-10-01',
  dueDate: null,
  currency: 'COP',
  subtotal: 100000,
  tax: 19000,
  total: 119000,
  lineItems: [
    {
      description: 'Resma carta',
      quantity: 2,
      unitPrice: 50000,
      amount: 100000,
    },
  ],
};

describe('invoiceSchema', () => {
  it('accepts a complete invoice', () => {
    expect(invoiceSchema.parse(validInvoice)).toEqual(validInvoice);
  });

  it('accepts null for fields missing from the document', () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, total: null });

    expect(result.success).toBe(true);
  });

  it('rejects an invoice without a required key', () => {
    const { total: _total, ...withoutTotal } = validInvoice;

    expect(invoiceSchema.safeParse(withoutTotal).success).toBe(false);
  });

  it('rejects a date that is not ISO formatted', () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice,
      issueDate: '01/10/2026',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a currency that is not an ISO 4217 code', () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, currency: '$' });

    expect(result.success).toBe(false);
  });
});

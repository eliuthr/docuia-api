import { DocumentType } from '../../src/ai/schemas/document-type.js';
import { InvoiceData } from '../../src/ai/schemas/invoice.schema.js';
import { DocumentStatus } from '../../src/documents/domain/document-status.enum.js';
import { DocumentEntity } from '../../src/documents/domain/document.entity.js';

/** Documento listo de ejemplo para los tests; se ajusta con `overrides`. */
export function buildDocument(
  overrides: Partial<DocumentEntity> = {},
): DocumentEntity {
  const now = new Date('2026-10-24T12:00:00.000Z');
  return {
    id: 'doc-1',
    originalName: 'factura.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 100,
    storageKey: 'doc-1.pdf',
    status: DocumentStatus.Ready,
    textStorageKey: 'doc-1.txt',
    pageCount: 1,
    failureReason: null,
    documentType: DocumentType.Invoice,
    summary: 'Factura de Tecnosuministros.',
    extractedData: buildInvoiceData(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function buildInvoiceData(
  overrides: Partial<InvoiceData> = {},
): InvoiceData {
  return {
    vendorName: 'Tecnosuministros del Caribe S.A.S.',
    vendorTaxId: '901.234.567-8',
    customerName: null,
    invoiceNumber: 'FEV-1',
    issueDate: '2026-10-14',
    dueDate: null,
    currency: 'COP',
    subtotal: null,
    tax: null,
    total: 1000,
    lineItems: [],
    ...overrides,
  };
}

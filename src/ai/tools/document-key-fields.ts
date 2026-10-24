import { DocumentEntity } from '../../documents/domain/document.entity.js';
import { ContractData } from '../schemas/contract.schema.js';
import { DocumentType } from '../schemas/document-type.js';
import { InvoiceData } from '../schemas/invoice.schema.js';
import { ResumeData } from '../schemas/resume.schema.js';

/**
 * Los campos más útiles de cada tipo, para listar documentos sin enviarle al
 * modelo todos sus datos (eso lo hace get_document_details).
 */
export function keyFieldsOf(document: DocumentEntity): Record<string, unknown> {
  const data = document.extractedData;
  if (!data) {
    return {};
  }
  switch (document.documentType) {
    case DocumentType.Invoice:
      return invoiceKeyFields(data as InvoiceData);
    case DocumentType.Contract:
      return contractKeyFields(data as ContractData);
    case DocumentType.Resume:
      return resumeKeyFields(data as ResumeData);
    default:
      return {};
  }
}

function invoiceKeyFields(invoice: InvoiceData): Record<string, unknown> {
  return {
    vendorName: invoice.vendorName,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    total: invoice.total,
    currency: invoice.currency,
  };
}

function contractKeyFields(contract: ContractData): Record<string, unknown> {
  return {
    title: contract.title,
    parties: contract.parties.map((party) => party.name),
    effectiveDate: contract.effectiveDate,
    value: contract.value,
    currency: contract.currency,
  };
}

function resumeKeyFields(resume: ResumeData): Record<string, unknown> {
  return {
    fullName: resume.fullName,
    location: resume.location,
    skills: resume.skills,
  };
}

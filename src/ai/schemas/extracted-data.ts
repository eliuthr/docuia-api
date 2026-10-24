import { ContractData } from './contract.schema.js';
import { InvoiceData } from './invoice.schema.js';
import { ResumeData } from './resume.schema.js';

/** Datos extraídos de un documento; la forma depende de su DocumentType. */
export type ExtractedData = InvoiceData | ContractData | ResumeData;

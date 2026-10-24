import { buildDocument } from '../../../test/support/build-document.js';
import { DocumentType } from '../schemas/document-type.js';
import { keyFieldsOf } from './document-key-fields.js';

describe('keyFieldsOf', () => {
  it('lists the parties and value of a contract', () => {
    const contract = buildDocument({
      documentType: DocumentType.Contract,
      extractedData: {
        title: 'Contrato de prestación de servicios',
        parties: [
          { name: 'Clínica Sonrisas', role: 'contratante' },
          { name: 'Juan Arrieta', role: 'contratista' },
        ],
        effectiveDate: '2026-11-03',
        expirationDate: '2027-02-02',
        value: 8000000,
        currency: 'COP',
        governingLaw: null,
      },
    });

    expect(keyFieldsOf(contract)).toEqual({
      title: 'Contrato de prestación de servicios',
      parties: ['Clínica Sonrisas', 'Juan Arrieta'],
      effectiveDate: '2026-11-03',
      value: 8000000,
      currency: 'COP',
    });
  });

  it('lists the name, location and skills of a résumé', () => {
    const resume = buildDocument({
      documentType: DocumentType.Resume,
      extractedData: {
        fullName: 'Andrés Coronado',
        email: null,
        phone: null,
        location: 'Sincelejo',
        summary: null,
        skills: ['NestJS'],
        experience: [],
        education: [],
      },
    });

    expect(keyFieldsOf(resume)).toEqual({
      fullName: 'Andrés Coronado',
      location: 'Sincelejo',
      skills: ['NestJS'],
    });
  });

  it('returns nothing for documents without extracted data', () => {
    const other = buildDocument({
      documentType: DocumentType.Other,
      extractedData: null,
    });

    expect(keyFieldsOf(other)).toEqual({});
  });
});

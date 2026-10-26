import { ExtractedData } from '../../ai/schemas/extracted-data.js';
import { DocumentSearchCriteria } from './document-search-criteria.js';
import { DocumentEntity } from './document.entity.js';

/**
 * Versión en memoria de la búsqueda de documentos, para bases de datos sin
 * búsqueda de texto (DynamoDB). Busca en los mismos campos que el filtro de
 * Mongo, sin distinguir mayúsculas ni tildes.
 */
export function matchesSearchCriteria(
  document: DocumentEntity,
  criteria: DocumentSearchCriteria,
): boolean {
  if (document.status !== criteria.status) {
    return false;
  }
  if (
    criteria.documentType &&
    document.documentType !== criteria.documentType
  ) {
    return false;
  }
  if (!criteria.text) {
    return true;
  }
  const query = normalize(criteria.text);
  return searchableTexts(document).some((text) =>
    normalize(text).includes(query),
  );
}

function searchableTexts(document: DocumentEntity): string[] {
  const texts = [
    document.originalName,
    document.summary,
    ...extractedNames(document.extractedData),
  ];
  return texts.filter((text): text is string => typeof text === 'string');
}

/** Proveedor y cliente (factura), partes (contrato) y nombre del candidato (hoja de vida). */
function extractedNames(data: ExtractedData | null): (string | null)[] {
  if (!data) {
    return [];
  }
  const names: (string | null)[] = [];
  if ('vendorName' in data) {
    names.push(data.vendorName, data.customerName);
  }
  if ('parties' in data) {
    names.push(...data.parties.map((party) => party.name));
  }
  if ('fullName' in data) {
    names.push(data.fullName);
  }
  return names;
}

/** Minúsculas y sin tildes: "Tecnosuministros" coincide con "TECNOSUMINISTROS". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

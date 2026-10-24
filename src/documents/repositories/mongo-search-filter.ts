import { QueryFilter } from 'mongoose';
import { DocumentSearchCriteria } from '../domain/document-search-criteria.js';
import { DocumentRecord } from '../schemas/document-record.schema.js';

/** Campos donde se busca el texto libre de `DocumentSearchCriteria`. */
export const MONGO_SEARCH_FIELDS = [
  'originalName',
  'summary',
  'extractedData.vendorName',
  'extractedData.customerName',
  'extractedData.parties.name',
  'extractedData.fullName',
] as const;

/** Traduce los criterios de búsqueda a un filtro de MongoDB. */
export function buildSearchFilter(
  criteria: DocumentSearchCriteria,
): QueryFilter<DocumentRecord> {
  const filter: QueryFilter<DocumentRecord> = { status: criteria.status };
  if (criteria.documentType) {
    filter.documentType = criteria.documentType;
  }
  if (criteria.text) {
    const pattern = new RegExp(escapeRegExp(criteria.text), 'i');
    filter.$or = MONGO_SEARCH_FIELDS.map((field) => ({ [field]: pattern }));
  }
  return filter;
}

/** El texto viene del modelo: se escapa para que no se interprete como expresión regular. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

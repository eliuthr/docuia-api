import { DocumentType } from '../../ai/schemas/document-type.js';
import { DocumentStatus } from '../domain/document-status.enum.js';
import { DocumentSearchCriteria } from '../domain/document-search-criteria.js';
import {
  buildSearchFilter,
  MONGO_SEARCH_FIELDS,
} from './mongo-search-filter.js';

const BASE_CRITERIA: DocumentSearchCriteria = {
  status: DocumentStatus.Ready,
  documentType: null,
  text: null,
  limit: 10,
};

describe('buildSearchFilter', () => {
  it('filters only by status when nothing else is given', () => {
    expect(buildSearchFilter(BASE_CRITERIA)).toEqual({
      status: DocumentStatus.Ready,
    });
  });

  it('filters by document type', () => {
    expect(
      buildSearchFilter({
        ...BASE_CRITERIA,
        documentType: DocumentType.Invoice,
      }),
    ).toEqual({ status: DocumentStatus.Ready, documentType: 'invoice' });
  });

  it('searches the text case-insensitively in every searchable field', () => {
    const filter = buildSearchFilter({ ...BASE_CRITERIA, text: 'Tecno' });

    expect(filter.$or).toHaveLength(MONGO_SEARCH_FIELDS.length);
    expect(filter.$or).toContainEqual({ 'extractedData.vendorName': /Tecno/i });
  });

  it('escapes regular expression characters in the text', () => {
    const filter = buildSearchFilter({
      ...BASE_CRITERIA,
      text: 'S.A.S. (Caribe)',
    });
    const [firstCondition] = filter.$or as Array<Record<string, RegExp>>;
    const pattern = Object.values(firstCondition)[0];

    expect(pattern.test('Tecnosuministros S.A.S. (Caribe)')).toBe(true);
    expect(pattern.test('SxAxSx (Caribe)')).toBe(false);
  });
});

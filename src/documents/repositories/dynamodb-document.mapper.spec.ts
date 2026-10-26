import { buildDocument } from '../../../test/support/build-document.js';
import {
  startKeyOf,
  toDocumentEntity,
  toDocumentItem,
} from './dynamodb-document.mapper.js';

describe('DynamoDB document mapper', () => {
  it('converts a document to an item and back', () => {
    const document = buildDocument();

    const item = toDocumentItem(document);

    expect(item).toMatchObject({
      listKey: 'DOCUMENT',
      createdAtId: '2026-10-24T12:00:00.000Z#doc-1',
      createdAt: '2026-10-24T12:00:00.000Z',
    });
    expect(toDocumentEntity(item)).toEqual(document);
  });

  it('reads missing optional fields as null', () => {
    const item = toDocumentItem(buildDocument());
    delete (item as Partial<typeof item>).summary;
    delete (item as Partial<typeof item>).extractedData;

    expect(toDocumentEntity(item)).toMatchObject({
      summary: null,
      extractedData: null,
    });
  });

  it('builds the start key of a cursor', () => {
    expect(
      startKeyOf({
        createdAt: new Date('2026-10-24T12:00:00.000Z'),
        id: 'doc-1',
      }),
    ).toEqual({
      id: 'doc-1',
      listKey: 'DOCUMENT',
      createdAtId: '2026-10-24T12:00:00.000Z#doc-1',
    });
  });
});

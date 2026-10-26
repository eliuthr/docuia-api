import { buildCursorFilter } from './mongo-cursor-filter.js';

describe('buildCursorFilter', () => {
  it('does not filter the first page', () => {
    expect(buildCursorFilter(null)).toEqual({});
  });

  it('keeps older documents and, on a tie, smaller ids', () => {
    const createdAt = new Date('2026-10-24T13:00:00.000Z');

    expect(buildCursorFilter({ createdAt, id: 'doc-5' })).toEqual({
      $or: [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: 'doc-5' } },
      ],
    });
  });
});

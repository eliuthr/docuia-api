import { buildSetExpression } from './build-set-expression.js';

describe('buildSetExpression', () => {
  it('sets every defined field through aliases', () => {
    expect(
      buildSetExpression({
        status: 'ready',
        failureReason: null,
        pageCount: undefined,
      }),
    ).toEqual({
      UpdateExpression: 'SET #f0 = :v0, #f1 = :v1',
      ExpressionAttributeNames: { '#f0': 'status', '#f1': 'failureReason' },
      ExpressionAttributeValues: { ':v0': 'ready', ':v1': null },
    });
  });
});

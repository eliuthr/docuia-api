import { documentCursorCodec } from './document-cursor.codec.js';

const CURSOR = {
  createdAt: new Date('2026-10-24T13:00:00.123Z'),
  id: '3a2465c7-fce3-45f9-ab39-d23b3b407e4f',
};

describe('documentCursorCodec', () => {
  it('round-trips a cursor', () => {
    const encoded = documentCursorCodec.encode(CURSOR);

    expect(documentCursorCodec.decode(encoded)).toEqual(CURSOR);
  });

  it('produces a URL-safe string', () => {
    expect(documentCursorCodec.encode(CURSOR)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['random text', 'not-a-cursor'],
    [
      'JSON without an id',
      Buffer.from('{"createdAt":"2026-10-24T13:00:00.000Z"}').toString(
        'base64url',
      ),
    ],
    [
      'an invalid date',
      Buffer.from('{"createdAt":"yesterday","id":"a"}').toString('base64url'),
    ],
  ])('rejects %s', (_case, encoded) => {
    expect(documentCursorCodec.decode(encoded)).toBeNull();
  });
});

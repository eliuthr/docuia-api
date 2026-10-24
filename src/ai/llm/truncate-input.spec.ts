import { truncateInput } from './truncate-input.js';

describe('truncateInput', () => {
  it('keeps text that fits', () => {
    const input = { kind: 'text', text: 'Total 150' } as const;

    expect(truncateInput(input, 100)).toBe(input);
  });

  it('cuts text longer than the limit', () => {
    expect(truncateInput({ kind: 'text', text: 'abcdef' }, 3)).toEqual({
      kind: 'text',
      text: 'abc',
    });
  });

  it('leaves images unchanged', () => {
    const input = {
      kind: 'image',
      mimeType: 'image/png',
      content: Buffer.from('png'),
    } as const;

    expect(truncateInput(input, 1)).toBe(input);
  });
});

import { PASSAGE_SIZE_CHARS, searchPassages } from './keyword-search.js';

describe('searchPassages', () => {
  it('finds a passage ignoring case and accents', () => {
    const text = 'CONTRATO de arrendamiento. Firmado en Montería.';

    expect(searchPassages(text, 'monteria', 5)).toEqual([
      { text, matchedTerms: 1 },
    ]);
  });

  it('ranks passages by the number of distinct terms they contain', () => {
    const filler = ' '.repeat(PASSAGE_SIZE_CHARS);
    const text = `canon mensual${filler}canon mensual del arrendamiento${filler}`;

    const [best] = searchPassages(text, 'valor del canon de arrendamiento', 5);

    expect(best.text).toContain('canon mensual del arrendamiento');
    expect(best.matchedTerms).toBe(3);
  });

  it('keeps short numbers as search terms', () => {
    expect(searchPassages('Cláusula 12: plazo', '12', 5)).toHaveLength(1);
  });

  it('returns nothing when no term matches', () => {
    expect(searchPassages('Factura de venta', 'contrato laboral', 5)).toEqual(
      [],
    );
  });

  it('ignores queries made only of short words', () => {
    expect(searchPassages('de la el', 'de la', 5)).toEqual([]);
  });

  it('limits the number of results', () => {
    const text = 'total '.repeat(2000);

    expect(searchPassages(text, 'total', 2)).toHaveLength(2);
  });

  it('overlaps passages so a phrase on a boundary is not lost', () => {
    const phrase = 'fecha de vencimiento';
    const text = `${'x'.repeat(PASSAGE_SIZE_CHARS - 10)}${phrase}${'x'.repeat(100)}`;

    const results = searchPassages(text, phrase, 5);

    expect(results.some((result) => result.text.includes(phrase))).toBe(true);
  });
});

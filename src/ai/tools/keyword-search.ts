export const PASSAGE_SIZE_CHARS = 800;
const PASSAGE_OVERLAP_CHARS = 200;
const MIN_TERM_LENGTH = 3;

export interface ScoredPassage {
  text: string;
  /** Cuántos términos distintos de la búsqueda aparecen en el fragmento. */
  matchedTerms: number;
}

/**
 * Búsqueda por palabras clave: divide el texto en fragmentos que se solapan
 * (para no cortar una frase justo en el borde) y los ordena por cuántos
 * términos de la búsqueda contienen, sin distinguir mayúsculas ni tildes.
 */
export function searchPassages(
  text: string,
  query: string,
  maxResults: number,
): ScoredPassage[] {
  const terms = extractTerms(query);
  if (terms.length === 0) {
    return [];
  }
  return splitIntoPassages(text)
    .map((passage) => ({
      text: passage,
      matchedTerms: countMatches(passage, terms),
    }))
    .filter((passage) => passage.matchedTerms > 0)
    .sort((first, second) => second.matchedTerms - first.matchedTerms)
    .slice(0, maxResults);
}

function extractTerms(query: string): string[] {
  const terms = normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= MIN_TERM_LENGTH || /^\d+$/.test(term));
  return [...new Set(terms)];
}

function splitIntoPassages(text: string): string[] {
  const step = PASSAGE_SIZE_CHARS - PASSAGE_OVERLAP_CHARS;
  const passages: string[] = [];
  for (let start = 0; start < text.length; start += step) {
    passages.push(text.slice(start, start + PASSAGE_SIZE_CHARS));
    if (start + PASSAGE_SIZE_CHARS >= text.length) {
      break;
    }
  }
  return passages;
}

function countMatches(passage: string, terms: string[]): number {
  const normalizedPassage = normalize(passage);
  return terms.filter((term) => normalizedPassage.includes(term)).length;
}

/** Minúsculas y sin tildes: "Montería" y "monteria" coinciden. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

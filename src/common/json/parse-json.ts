/** Devuelve undefined si el texto no es JSON, para que la validación de Zod lo rechace. */
export function parseJson(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    return undefined;
  }
}

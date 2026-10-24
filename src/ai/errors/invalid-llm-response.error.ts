/** El modelo respondió algo que no cumple el esquema, incluso después del reintento. */
export class InvalidLlmResponseError extends Error {
  override readonly name = 'InvalidLlmResponseError';

  constructor(schemaName: string) {
    super(`The LLM response did not match the "${schemaName}" schema.`);
  }
}

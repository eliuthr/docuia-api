import { LlmInput } from './llm.provider.js';

/** Recorta el texto a `maxChars` para acotar el costo; las imágenes pasan sin cambios. */
export function truncateInput(input: LlmInput, maxChars: number): LlmInput {
  if (input.kind !== 'text' || input.text.length <= maxChars) {
    return input;
  }
  return { kind: 'text', text: input.text.slice(0, maxChars) };
}

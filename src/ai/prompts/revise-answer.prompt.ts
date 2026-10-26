/** Mensaje que se agrega a la conversación cuando el verificador rechaza la respuesta. */
export function buildRevisionRequest(feedback: string): string {
  return `A reviewer checked your previous answer against the tool results and found problems:
${JSON.stringify(feedback)}

Write a corrected answer to my original question. Call the tools again if you need more data.
Do not mention the reviewer.`;
}

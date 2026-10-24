/** Lo que el cliente recibe mientras se construye la respuesta (cada uno es un evento SSE). */
export type AnswerEvent =
  | { type: 'tool'; name: string }
  | { type: 'delta'; text: string }
  | { type: 'done' };

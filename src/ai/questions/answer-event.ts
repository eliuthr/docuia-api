/** Paso del agente que el cliente puede mostrar mientras espera la respuesta. */
export type AgentStep = 'classifying' | 'answering' | 'verifying' | 'revising';

/** Lo que el cliente recibe mientras se construye la respuesta (cada uno es un evento SSE). */
export type AnswerEvent =
  | { type: 'conversation'; id: string }
  | { type: 'status'; step: AgentStep }
  | { type: 'tool'; name: string }
  | { type: 'delta'; text: string }
  | { type: 'done' };

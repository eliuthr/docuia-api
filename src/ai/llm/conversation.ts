import { JsonSchema } from './json-schema.js';

/**
 * Un paso de una conversación con herramientas, en un formato neutral: cada
 * proveedor lo traduce a su propio formato de mensajes.
 */
export type ConversationItem =
  | { kind: 'user_message'; text: string }
  | { kind: 'assistant_message'; text: string }
  | { kind: 'tool_call'; callId: string; toolName: string; arguments: string }
  | { kind: 'tool_result'; callId: string; output: string };

export type ToolCallItem = Extract<ConversationItem, { kind: 'tool_call' }>;

/** Lo que el modelo sabe de una herramienta: cuándo usarla y qué argumentos recibe. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface TurnRequest {
  /** Datos para los logs (endpoint, documentId); nunca la pregunta ni el contenido. */
  logContext: Record<string, string>;
  instructions: string;
  items: ConversationItem[];
  /** Vacío en la última vuelta permitida, para obligar al modelo a responder. */
  tools: ToolDefinition[];
  maxOutputTokens: number;
  /** Se aborta cuando el cliente se desconecta, para no seguir gastando tokens. */
  signal: AbortSignal;
}

export type TurnEvent =
  | { type: 'text_delta'; text: string }
  /** Fin de la vuelta: el texto completo y las llamadas a herramientas que pidió el modelo. */
  | { type: 'turn_completed'; items: ConversationItem[] };

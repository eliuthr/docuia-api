import { Annotation } from '@langchain/langgraph';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { ConversationItem, ToolCallItem } from '../llm/conversation.js';
import { AnswerVerdict } from '../schemas/answer-verdict.schema.js';
import { QuestionCategory } from './question-category.js';

/** Canal que guarda el último valor escrito (sin acumular). */
function lastValue<T>(initial: () => T) {
  return Annotation<T>({ reducer: (_current, next) => next, default: initial });
}

/** Canal que acumula lo que escribe cada nodo. */
function appended<T>() {
  return Annotation<T[]>({
    reducer: (current, next) => current.concat(next),
    default: () => [],
  });
}

/**
 * Estado compartido del grafo. Cada nodo lo lee completo y devuelve solo los
 * campos que cambia; los reductores deciden cómo se combinan.
 */
export const AgentState = Annotation.Root({
  question: lastValue<string>(() => ''),
  /** Historial, pregunta, respuestas del modelo y resultados de herramientas. */
  items: appended<ConversationItem>(),
  category: lastValue<QuestionCategory | null>(() => null),
  /** Herramientas que pidió el modelo en su última vuelta y aún no se ejecutan. */
  pendingToolCalls: lastValue<ToolCallItem[]>(() => []),
  /** Texto de la última vuelta del modelo: la respuesta candidata. */
  draft: lastValue<string>(() => ''),
  /** Resultados de las herramientas, que el verificador usa como evidencia. */
  evidence: appended<string>(),
  /** Vueltas de respuesta usadas (incluidas las revisiones). */
  turns: lastValue<number>(() => 0),
  revisions: lastValue<number>(() => 0),
  verdict: lastValue<AnswerVerdict | null>(() => null),
});

export type AgentStateValues = typeof AgentState.State;
export type AgentStateUpdate = typeof AgentState.Update;

/** Datos de la petición que no cambian durante la ejecución del grafo. */
export const AgentContextSchema = Annotation.Root({
  /** Datos para los logs (endpoint, documentId, conversationId). */
  logContext: Annotation<Record<string, string>>,
  /** Prompt de sistema para responder (documento o colección). */
  instructions: Annotation<string>,
  /** Se aborta cuando el cliente se desconecta, para no seguir gastando tokens. */
  signal: Annotation<AbortSignal>,
});

export type AgentContext = typeof AgentContextSchema.State;

export type AgentRuntime = LangGraphRunnableConfig<AgentContext>;

export function getAgentContext(runtime: AgentRuntime): AgentContext {
  if (!runtime.context) {
    throw new Error('The question graph must run with an AgentContext.');
  }
  return runtime.context;
}

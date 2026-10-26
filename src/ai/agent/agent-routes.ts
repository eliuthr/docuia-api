import { AgentStateValues } from './agent-state.js';
import { QuestionCategory } from './question-category.js';

export enum AgentNode {
  Classify = 'classify',
  Respond = 'respond',
  CallModel = 'callModel',
  RunTools = 'runTools',
  Verify = 'verify',
  Revise = 'revise',
  EmitAnswer = 'emitAnswer',
}

/** Veces que el verificador puede pedir corregir una respuesta. */
export const MAX_ANSWER_REVISIONS = 1;

/**
 * Aristas condicionales: leen el estado y devuelven el siguiente nodo. Toda la
 * lógica de enrutamiento vive aquí, no dentro de los nodos.
 */
export function routeAfterClassify(state: AgentStateValues): AgentNode {
  return state.category === QuestionCategory.Conversational
    ? AgentNode.Respond
    : AgentNode.CallModel;
}

/** Sin herramientas usadas no hay evidencia que verificar. */
export function routeAfterModel(state: AgentStateValues): AgentNode {
  if (state.pendingToolCalls.length > 0) {
    return AgentNode.RunTools;
  }
  return state.evidence.length > 0 ? AgentNode.Verify : AgentNode.EmitAnswer;
}

export function createRouteAfterVerify(maxIterations: number) {
  return (state: AgentStateValues): AgentNode => {
    const canRevise =
      state.verdict?.verdict === 'unsupported' &&
      state.revisions < MAX_ANSWER_REVISIONS &&
      state.turns < maxIterations;
    return canRevise ? AgentNode.Revise : AgentNode.EmitAnswer;
  };
}

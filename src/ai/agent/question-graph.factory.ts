import { END, START, StateGraph } from '@langchain/langgraph';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import {
  AgentNode,
  createRouteAfterVerify,
  routeAfterClassify,
  routeAfterModel,
} from './agent-routes.js';
import {
  AgentRuntime,
  AgentContextSchema,
  AgentState,
  AgentStateUpdate,
  AgentStateValues,
} from './agent-state.js';
import { CallModelNode } from './nodes/call-model.node.js';
import { ClassifyQuestionNode } from './nodes/classify-question.node.js';
import { EmitAnswerNode } from './nodes/emit-answer.node.js';
import { RespondNode } from './nodes/respond.node.js';
import { ReviseAnswerNode } from './nodes/revise-answer.node.js';
import { RunToolsNode } from './nodes/run-tools.node.js';
import { VerifyAnswerNode } from './nodes/verify-answer.node.js';

/** Lo que tiene que cumplir un nodo para entrar al grafo. */
export interface AgentGraphNode {
  run(
    state: AgentStateValues,
    runtime: AgentRuntime,
  ): AgentStateUpdate | Promise<AgentStateUpdate>;
}

export type QuestionGraphNodes = Record<AgentNode, AgentGraphNode>;

/**
 * Arma el grafo del agente:
 *
 *   START → classify ─conversational→ respond → END
 *              └→ callModel ⇄ runTools
 *                    └→ verify ─unsupported→ revise → callModel
 *                    └──────────┴→ emitAnswer → END
 */
export function buildQuestionGraph(
  nodes: QuestionGraphNodes,
  maxIterations: number,
) {
  const runNode =
    (node: AgentNode) => (state: AgentStateValues, runtime: AgentRuntime) =>
      nodes[node].run(state, runtime);

  return new StateGraph(AgentState, AgentContextSchema)
    .addNode(AgentNode.Classify, runNode(AgentNode.Classify))
    .addNode(AgentNode.Respond, runNode(AgentNode.Respond))
    .addNode(AgentNode.CallModel, runNode(AgentNode.CallModel))
    .addNode(AgentNode.RunTools, runNode(AgentNode.RunTools))
    .addNode(AgentNode.Verify, runNode(AgentNode.Verify))
    .addNode(AgentNode.Revise, runNode(AgentNode.Revise))
    .addNode(AgentNode.EmitAnswer, runNode(AgentNode.EmitAnswer))
    .addEdge(START, AgentNode.Classify)
    .addConditionalEdges(AgentNode.Classify, routeAfterClassify, [
      AgentNode.Respond,
      AgentNode.CallModel,
    ])
    .addEdge(AgentNode.Respond, END)
    .addConditionalEdges(AgentNode.CallModel, routeAfterModel, [
      AgentNode.RunTools,
      AgentNode.Verify,
      AgentNode.EmitAnswer,
    ])
    .addEdge(AgentNode.RunTools, AgentNode.CallModel)
    .addConditionalEdges(
      AgentNode.Verify,
      createRouteAfterVerify(maxIterations),
      [AgentNode.Revise, AgentNode.EmitAnswer],
    )
    .addEdge(AgentNode.Revise, AgentNode.CallModel)
    .addEdge(AgentNode.EmitAnswer, END)
    .compile();
}

export type QuestionGraph = ReturnType<typeof buildQuestionGraph>;

@Injectable()
export class QuestionGraphFactory {
  constructor(
    private readonly classify: ClassifyQuestionNode,
    private readonly respond: RespondNode,
    private readonly callModel: CallModelNode,
    private readonly runTools: RunToolsNode,
    private readonly verify: VerifyAnswerNode,
    private readonly revise: ReviseAnswerNode,
    private readonly emitAnswer: EmitAnswerNode,
    private readonly config: ConfigService<Env, true>,
  ) {}

  create(): QuestionGraph {
    return buildQuestionGraph(
      {
        [AgentNode.Classify]: this.classify,
        [AgentNode.Respond]: this.respond,
        [AgentNode.CallModel]: this.callModel,
        [AgentNode.RunTools]: this.runTools,
        [AgentNode.Verify]: this.verify,
        [AgentNode.Revise]: this.revise,
        [AgentNode.EmitAnswer]: this.emitAnswer,
      },
      this.config.get('AGENT_MAX_ITERATIONS', { infer: true }),
    );
  }
}

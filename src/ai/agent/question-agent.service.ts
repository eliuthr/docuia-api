import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import { ConversationItem } from '../llm/conversation.js';
import { AnswerEvent } from '../questions/answer-event.js';
import { AgentStateValues } from './agent-state.js';
import {
  QuestionGraph,
  QuestionGraphFactory,
} from './question-graph.factory.js';

/**
 * Pasos que no se repiten por vuelta (classify, verify ×2, revise, emitAnswer
 * y margen). Cada vuelta usa dos pasos: callModel y runTools.
 */
const FIXED_GRAPH_STEPS = 6;
const STEPS_PER_TURN = 2;

export interface AgentRunRequest {
  logContext: Record<string, string>;
  instructions: string;
  /** Mensajes anteriores de la conversación, del más antiguo al más reciente. */
  history: ConversationItem[];
  question: string;
  signal: AbortSignal;
}

/** Ejecuta el grafo del agente y reenvía sus eventos; devuelve la respuesta final. */
@Injectable()
export class QuestionAgentService {
  private readonly logger = new Logger(QuestionAgentService.name);
  private readonly graph: QuestionGraph;
  /** Segundo freno, por si un error de enrutamiento armara un ciclo. */
  private readonly recursionLimit: number;

  constructor(
    graphFactory: QuestionGraphFactory,
    config: ConfigService<Env, true>,
  ) {
    this.graph = graphFactory.create();
    const maxIterations = config.get('AGENT_MAX_ITERATIONS', { infer: true });
    this.recursionLimit = STEPS_PER_TURN * maxIterations + FIXED_GRAPH_STEPS;
  }

  async *run(request: AgentRunRequest): AsyncGenerator<AnswerEvent, string> {
    const stream = await this.graph.stream(
      {
        question: request.question,
        items: [
          ...request.history,
          { kind: 'user_message', text: request.question },
        ],
      },
      {
        // custom: los eventos que emiten los nodos; values: el estado después de cada paso.
        streamMode: ['custom', 'values'],
        context: {
          logContext: request.logContext,
          instructions: request.instructions,
          signal: request.signal,
        },
        signal: request.signal,
        recursionLimit: this.recursionLimit,
      },
    );
    let finalState: AgentStateValues | null = null;
    for await (const [mode, chunk] of stream) {
      if (mode === 'custom') {
        yield chunk as AnswerEvent;
        continue;
      }
      finalState = chunk as AgentStateValues;
    }
    return this.finish(request, finalState);
  }

  private finish(
    request: AgentRunRequest,
    finalState: AgentStateValues | null,
  ): string {
    if (!finalState) {
      throw new Error('The question graph ended without a state.');
    }
    this.logger.log({
      event: 'question.answered',
      ...request.logContext,
      category: finalState.category,
      toolsUsed: toolsUsed(finalState.items),
      turns: finalState.turns,
      verdict: finalState.verdict?.verdict ?? null,
      revisions: finalState.revisions,
    });
    return finalState.draft;
  }
}

function toolsUsed(items: ConversationItem[]): string[] {
  return items.flatMap((item) =>
    item.kind === 'tool_call' ? [item.toolName] : [],
  );
}

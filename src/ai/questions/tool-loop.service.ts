import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema.js';
import { ConversationItem, ToolCallItem } from '../llm/conversation.js';
import { LlmProvider } from '../llm/llm.provider.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { AnswerEvent } from './answer-event.js';

export const ANSWER_MAX_OUTPUT_TOKENS = 2000;

export interface ToolLoopRequest {
  logContext: Record<string, string>;
  instructions: string;
  question: string;
  signal: AbortSignal;
}

/**
 * Bucle de tool calling: el modelo pide herramientas, las ejecutamos, le
 * devolvemos los resultados y repetimos hasta que responda. La última vuelta
 * permitida va sin herramientas para obligarlo a responder.
 */
@Injectable()
export class ToolLoopService {
  private readonly logger = new Logger(ToolLoopService.name);
  private readonly maxIterations: number;

  constructor(
    private readonly llm: LlmProvider,
    private readonly tools: ToolRegistry,
    config: ConfigService<Env, true>,
  ) {
    this.maxIterations = config.get('AGENT_MAX_ITERATIONS', { infer: true });
  }

  async *run(request: ToolLoopRequest): AsyncGenerator<AnswerEvent> {
    const items: ConversationItem[] = [
      { kind: 'user_message', text: request.question },
    ];
    const toolsUsed: string[] = [];

    for (let turn = 1; turn <= this.maxIterations; turn++) {
      const isLastTurn = turn === this.maxIterations;
      const toolCalls = yield* this.runTurn(request, items, isLastTurn);
      if (toolCalls.length === 0) {
        this.logAnswered(request, turn, toolsUsed);
        break;
      }
      for (const call of toolCalls) {
        yield { type: 'tool', name: call.toolName };
        toolsUsed.push(call.toolName);
        items.push(await this.executeTool(call));
      }
    }
    yield { type: 'done' };
  }

  /** Transmite el texto de una vuelta y devuelve las herramientas que pidió el modelo. */
  private async *runTurn(
    request: ToolLoopRequest,
    items: ConversationItem[],
    isLastTurn: boolean,
  ): AsyncGenerator<AnswerEvent, ToolCallItem[]> {
    const turn = this.llm.streamTurn({
      logContext: request.logContext,
      instructions: request.instructions,
      items: [...items],
      tools: isLastTurn ? [] : this.tools.definitions(),
      maxOutputTokens: ANSWER_MAX_OUTPUT_TOKENS,
      signal: request.signal,
    });
    let toolCalls: ToolCallItem[] = [];
    for await (const event of turn) {
      if (event.type === 'text_delta') {
        yield { type: 'delta', text: event.text };
        continue;
      }
      items.push(...event.items);
      toolCalls = event.items.filter(
        (item): item is ToolCallItem => item.kind === 'tool_call',
      );
    }
    return toolCalls;
  }

  private async executeTool(call: ToolCallItem): Promise<ConversationItem> {
    const output = await this.tools.execute(call.toolName, call.arguments);
    return { kind: 'tool_result', callId: call.callId, output };
  }

  private logAnswered(
    request: ToolLoopRequest,
    turns: number,
    toolsUsed: string[],
  ): void {
    this.logger.log({
      event: 'question.answered',
      ...request.logContext,
      turns,
      toolsUsed,
    });
  }
}

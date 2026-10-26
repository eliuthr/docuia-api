import { Injectable, Logger } from '@nestjs/common';
import { InvalidLlmResponseError } from '../../errors/invalid-llm-response.error.js';
import { StructuredOutputService } from '../../extraction/structured-output.service.js';
import { ConversationItem } from '../../llm/conversation.js';
import { CLASSIFY_QUESTION_PROMPT } from '../../prompts/classify-question.prompt.js';
import { questionClassificationSchema } from '../../schemas/question-classification.schema.js';
import {
  AgentRuntime,
  AgentStateUpdate,
  AgentStateValues,
  getAgentContext,
} from '../agent-state.js';
import { emitEvent } from '../emit-event.js';
import { FALLBACK_CATEGORY, QuestionCategory } from '../question-category.js';

export const CLASSIFY_MAX_OUTPUT_TOKENS = 200;

/** Decide el tipo de pregunta, y con él qué herramientas verá el modelo. */
@Injectable()
export class ClassifyQuestionNode {
  private readonly logger = new Logger(ClassifyQuestionNode.name);

  constructor(private readonly structuredOutput: StructuredOutputService) {}

  async run(
    state: AgentStateValues,
    runtime: AgentRuntime,
  ): Promise<AgentStateUpdate> {
    emitEvent(runtime, { type: 'status', step: 'classifying' });
    return { category: await this.classify(state, runtime) };
  }

  private async classify(
    state: AgentStateValues,
    runtime: AgentRuntime,
  ): Promise<QuestionCategory> {
    const { logContext } = getAgentContext(runtime);
    try {
      const { category } = await this.structuredOutput.generate({
        logContext,
        instructions: CLASSIFY_QUESTION_PROMPT,
        input: { kind: 'text', text: buildClassificationInput(state) },
        schemaName: 'question_classification',
        schema: questionClassificationSchema,
        maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
      });
      return category;
    } catch (error) {
      if (!(error instanceof InvalidLlmResponseError)) {
        throw error;
      }
      this.logger.warn({
        event: 'question.classification.fallback',
        ...logContext,
      });
      return FALLBACK_CATEGORY;
    }
  }
}

/** El historial va como datos JSON, separado de la pregunta nueva. */
function buildClassificationInput(state: AgentStateValues): string {
  const history = state.items
    .slice(0, -1)
    .flatMap((item) => toHistoryEntry(item));
  return JSON.stringify({ history, question: state.question });
}

function toHistoryEntry(item: ConversationItem) {
  if (item.kind === 'user_message') {
    return [{ role: 'user', text: item.text }];
  }
  if (item.kind === 'assistant_message') {
    return [{ role: 'assistant', text: item.text }];
  }
  return [];
}

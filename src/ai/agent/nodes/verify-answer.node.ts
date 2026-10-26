import { Injectable, Logger } from '@nestjs/common';
import { InvalidLlmResponseError } from '../../errors/invalid-llm-response.error.js';
import { StructuredOutputService } from '../../extraction/structured-output.service.js';
import { VERIFY_ANSWER_PROMPT } from '../../prompts/verify-answer.prompt.js';
import {
  AnswerVerdict,
  answerVerdictSchema,
} from '../../schemas/answer-verdict.schema.js';
import {
  AgentRuntime,
  AgentStateUpdate,
  AgentStateValues,
  getAgentContext,
} from '../agent-state.js';
import { emitEvent } from '../emit-event.js';

export const VERIFY_MAX_OUTPUT_TOKENS = 400;
/** Tope de la evidencia que se le envía al verificador, para acotar el costo. */
export const MAX_VERIFICATION_EVIDENCE_CHARS = 12000;

/** Revisa que el borrador esté respaldado por los resultados de las herramientas. */
@Injectable()
export class VerifyAnswerNode {
  private readonly logger = new Logger(VerifyAnswerNode.name);

  constructor(private readonly structuredOutput: StructuredOutputService) {}

  async run(
    state: AgentStateValues,
    runtime: AgentRuntime,
  ): Promise<AgentStateUpdate> {
    emitEvent(runtime, { type: 'status', step: 'verifying' });
    return { verdict: await this.verify(state, runtime) };
  }

  /** null si el veredicto no pasó la validación: se envía el borrador sin verificar. */
  private async verify(
    state: AgentStateValues,
    runtime: AgentRuntime,
  ): Promise<AnswerVerdict | null> {
    const { logContext } = getAgentContext(runtime);
    try {
      return await this.structuredOutput.generate({
        logContext,
        instructions: VERIFY_ANSWER_PROMPT,
        input: { kind: 'text', text: buildVerificationInput(state) },
        schemaName: 'answer_verdict',
        schema: answerVerdictSchema,
        maxOutputTokens: VERIFY_MAX_OUTPUT_TOKENS,
      });
    } catch (error) {
      if (!(error instanceof InvalidLlmResponseError)) {
        throw error;
      }
      this.logger.warn({ event: 'answer.verification.skipped', ...logContext });
      return null;
    }
  }
}

function buildVerificationInput(state: AgentStateValues): string {
  return JSON.stringify({
    question: state.question,
    answer: state.draft,
    evidence: state.evidence
      .join('\n')
      .slice(0, MAX_VERIFICATION_EVIDENCE_CHARS),
  });
}

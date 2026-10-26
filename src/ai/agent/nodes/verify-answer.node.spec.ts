import { Logger } from '@nestjs/common';
import {
  AGENT_LOG_CONTEXT,
  buildAgentRuntime,
  buildAgentState,
} from '../../../../test/support/agent-fixtures.js';
import { InvalidLlmResponseError } from '../../errors/invalid-llm-response.error.js';
import { StructuredOutputService } from '../../extraction/structured-output.service.js';
import { VERIFY_ANSWER_PROMPT } from '../../prompts/verify-answer.prompt.js';
import { answerVerdictSchema } from '../../schemas/answer-verdict.schema.js';
import {
  MAX_VERIFICATION_EVIDENCE_CHARS,
  VerifyAnswerNode,
} from './verify-answer.node.js';

const SUPPORTED = { verdict: 'supported', feedback: '' };

describe('VerifyAnswerNode', () => {
  let generate: ReturnType<typeof vi.fn>;
  let node: VerifyAnswerNode;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    generate = vi.fn().mockResolvedValue(SUPPORTED);
    node = new VerifyAnswerNode({
      generate,
    } as unknown as StructuredOutputService);
  });

  it('stores the verdict and reports the step', async () => {
    const { runtime, events } = buildAgentRuntime();

    await expect(node.run(buildAgentState(), runtime)).resolves.toEqual({
      verdict: SUPPORTED,
    });
    expect(events).toEqual([{ type: 'status', step: 'verifying' }]);
  });

  it('sends the question, the draft and the evidence as JSON', async () => {
    await node.run(
      buildAgentState({
        draft: 'Suman 150 USD.',
        evidence: ['sum_invoice_totals: {"total":150}'],
      }),
      buildAgentRuntime().runtime,
    );

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        logContext: AGENT_LOG_CONTEXT,
        instructions: VERIFY_ANSWER_PROMPT,
        schema: answerVerdictSchema,
      }),
    );
    const [request] = generate.mock.calls[0] as [{ input: { text: string } }];
    expect(JSON.parse(request.input.text)).toEqual({
      question: '¿Cuánto suman las facturas?',
      answer: 'Suman 150 USD.',
      evidence: 'sum_invoice_totals: {"total":150}',
    });
  });

  it('cuts the evidence to MAX_VERIFICATION_EVIDENCE_CHARS', async () => {
    await node.run(
      buildAgentState({
        evidence: ['x'.repeat(MAX_VERIFICATION_EVIDENCE_CHARS * 2)],
      }),
      buildAgentRuntime().runtime,
    );

    const [request] = generate.mock.calls[0] as [{ input: { text: string } }];
    const { evidence } = JSON.parse(request.input.text) as {
      evidence: string;
    };
    expect(evidence).toHaveLength(MAX_VERIFICATION_EVIDENCE_CHARS);
  });

  it('skips verification when the verdict is invalid', async () => {
    generate.mockRejectedValue(new InvalidLlmResponseError('answer_verdict'));

    await expect(
      node.run(buildAgentState(), buildAgentRuntime().runtime),
    ).resolves.toEqual({ verdict: null });
  });

  it('lets other errors through', async () => {
    generate.mockRejectedValue(new Error('timeout'));

    await expect(
      node.run(buildAgentState(), buildAgentRuntime().runtime),
    ).rejects.toThrow('timeout');
  });
});

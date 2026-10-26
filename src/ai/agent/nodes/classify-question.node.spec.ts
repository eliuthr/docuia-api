import { Logger } from '@nestjs/common';
import {
  AGENT_LOG_CONTEXT,
  buildAgentRuntime,
  buildAgentState,
} from '../../../../test/support/agent-fixtures.js';
import { InvalidLlmResponseError } from '../../errors/invalid-llm-response.error.js';
import { StructuredOutputService } from '../../extraction/structured-output.service.js';
import { CLASSIFY_QUESTION_PROMPT } from '../../prompts/classify-question.prompt.js';
import { questionClassificationSchema } from '../../schemas/question-classification.schema.js';
import { FALLBACK_CATEGORY, QuestionCategory } from '../question-category.js';
import { ClassifyQuestionNode } from './classify-question.node.js';

describe('ClassifyQuestionNode', () => {
  let generate: ReturnType<typeof vi.fn>;
  let node: ClassifyQuestionNode;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    generate = vi
      .fn()
      .mockResolvedValue({ category: QuestionCategory.TextSearch });
    node = new ClassifyQuestionNode({
      generate,
    } as unknown as StructuredOutputService);
  });

  it('stores the category chosen by the model and reports the step', async () => {
    const { runtime, events } = buildAgentRuntime();

    await expect(node.run(buildAgentState(), runtime)).resolves.toEqual({
      category: QuestionCategory.TextSearch,
    });
    expect(events).toEqual([{ type: 'status', step: 'classifying' }]);
  });

  it('sends the history and the new question as separate JSON fields', async () => {
    const state = buildAgentState({
      question: '¿Y la otra?',
      items: [
        { kind: 'user_message', text: '¿Cuál es la factura más alta?' },
        { kind: 'assistant_message', text: 'La FE-1024.' },
        { kind: 'user_message', text: '¿Y la otra?' },
      ],
    });

    await node.run(state, buildAgentRuntime().runtime);

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        logContext: AGENT_LOG_CONTEXT,
        instructions: CLASSIFY_QUESTION_PROMPT,
        schema: questionClassificationSchema,
      }),
    );
    const [request] = generate.mock.calls[0] as [{ input: { text: string } }];
    expect(JSON.parse(request.input.text)).toEqual({
      history: [
        { role: 'user', text: '¿Cuál es la factura más alta?' },
        { role: 'assistant', text: 'La FE-1024.' },
      ],
      question: '¿Y la otra?',
    });
  });

  it('falls back to the category with every tool when the output is invalid', async () => {
    generate.mockRejectedValue(
      new InvalidLlmResponseError('question_classification'),
    );

    await expect(
      node.run(buildAgentState(), buildAgentRuntime().runtime),
    ).resolves.toEqual({ category: FALLBACK_CATEGORY });
  });

  it('lets other errors through', async () => {
    generate.mockRejectedValue(new Error('quota exceeded'));

    await expect(
      node.run(buildAgentState(), buildAgentRuntime().runtime),
    ).rejects.toThrow('quota exceeded');
  });
});

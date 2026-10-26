import {
  AgentNode,
  createRouteAfterVerify,
  routeAfterClassify,
  routeAfterModel,
} from './agent-routes.js';
import { AgentStateValues } from './agent-state.js';
import { QuestionCategory } from './question-category.js';

const MAX_ITERATIONS = 5;
const UNSUPPORTED = {
  verdict: 'unsupported',
  feedback: 'Wrong total.',
} as const;

function buildState(
  overrides: Partial<AgentStateValues> = {},
): AgentStateValues {
  return {
    question: '¿Total?',
    items: [],
    category: QuestionCategory.Lookup,
    pendingToolCalls: [],
    draft: '',
    evidence: [],
    turns: 1,
    revisions: 0,
    verdict: null,
    ...overrides,
  };
}

describe('agent routes', () => {
  describe('routeAfterClassify', () => {
    it('answers conversational questions directly', () => {
      expect(
        routeAfterClassify(
          buildState({ category: QuestionCategory.Conversational }),
        ),
      ).toBe(AgentNode.Respond);
    });

    it.each([
      QuestionCategory.Lookup,
      QuestionCategory.TextSearch,
      QuestionCategory.Calculation,
    ])('sends %s questions to the model with tools', (category) => {
      expect(routeAfterClassify(buildState({ category }))).toBe(
        AgentNode.CallModel,
      );
    });
  });

  describe('routeAfterModel', () => {
    it('runs the tools the model asked for', () => {
      const pendingToolCalls = [
        {
          kind: 'tool_call',
          callId: 'call-1',
          toolName: 'find_documents',
          arguments: '{}',
        } as const,
      ];

      expect(routeAfterModel(buildState({ pendingToolCalls }))).toBe(
        AgentNode.RunTools,
      );
    });

    it('verifies an answer built from tool results', () => {
      expect(routeAfterModel(buildState({ evidence: ['{"total":1}'] }))).toBe(
        AgentNode.Verify,
      );
    });

    it('sends an answer without tool results as it is', () => {
      expect(routeAfterModel(buildState())).toBe(AgentNode.EmitAnswer);
    });
  });

  describe('routeAfterVerify', () => {
    const routeAfterVerify = createRouteAfterVerify(MAX_ITERATIONS);

    it('sends a supported answer', () => {
      expect(
        routeAfterVerify(
          buildState({ verdict: { verdict: 'supported', feedback: '' } }),
        ),
      ).toBe(AgentNode.EmitAnswer);
    });

    it('revises an unsupported answer once', () => {
      expect(routeAfterVerify(buildState({ verdict: UNSUPPORTED }))).toBe(
        AgentNode.Revise,
      );
      expect(
        routeAfterVerify(buildState({ verdict: UNSUPPORTED, revisions: 1 })),
      ).toBe(AgentNode.EmitAnswer);
    });

    it('sends the draft when no turns are left', () => {
      expect(
        routeAfterVerify(
          buildState({ verdict: UNSUPPORTED, turns: MAX_ITERATIONS }),
        ),
      ).toBe(AgentNode.EmitAnswer);
    });

    it('sends the draft when verification was skipped', () => {
      expect(routeAfterVerify(buildState({ verdict: null }))).toBe(
        AgentNode.EmitAnswer,
      );
    });
  });
});

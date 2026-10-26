import { answerVerdictSchema } from './answer-verdict.schema.js';

describe('answerVerdictSchema', () => {
  it('accepts a supported answer with empty feedback', () => {
    expect(
      answerVerdictSchema.parse({ verdict: 'supported', feedback: '' }),
    ).toEqual({ verdict: 'supported', feedback: '' });
  });

  it('accepts an unsupported answer with feedback', () => {
    const verdict = {
      verdict: 'unsupported',
      feedback: 'The total is 119.000 COP, not 190.000 COP.',
    };

    expect(answerVerdictSchema.parse(verdict)).toEqual(verdict);
  });

  it('rejects an unknown verdict or a missing feedback', () => {
    expect(
      answerVerdictSchema.safeParse({ verdict: 'maybe', feedback: '' }).success,
    ).toBe(false);
    expect(
      answerVerdictSchema.safeParse({ verdict: 'supported' }).success,
    ).toBe(false);
  });
});

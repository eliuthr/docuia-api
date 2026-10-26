import { QuestionCategory } from '../agent/question-category.js';
import { questionClassificationSchema } from './question-classification.schema.js';

describe('questionClassificationSchema', () => {
  it.each(Object.values(QuestionCategory))('accepts %s', (category) => {
    expect(questionClassificationSchema.parse({ category })).toEqual({
      category,
    });
  });

  it('rejects an unknown category', () => {
    expect(
      questionClassificationSchema.safeParse({ category: 'weather' }).success,
    ).toBe(false);
  });
});

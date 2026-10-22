import {
  getQuizAnswerResult,
  QUIZ_SETTINGS,
  toPublicQuizQuestions,
} from './quizConstants';

describe('Quiz helpers', () => {
  test('removes answer keys from questions shared with players', () => {
    expect(toPublicQuizQuestions([{
      question: 'Which answer?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      resource: 'https://example.com',
    }])).toEqual([{
      question: 'Which answer?',
      options: ['A', 'B', 'C', 'D'],
      resource: 'https://example.com',
    }]);
  });

  test('awards a capped speed bonus for correct on-time answers', () => {
    const start = 100000;
    expect(getQuizAnswerResult(1, 1, start, start)).toEqual({
      correct: true,
      score: QUIZ_SETTINGS.maxScore,
      late: false,
    });
    expect(getQuizAnswerResult(1, 1, start + 5000, start).score).toBe(750);
    expect(getQuizAnswerResult(1, 1, start - 1000, start).score).toBe(QUIZ_SETTINGS.maxScore);
    expect(getQuizAnswerResult(1, 1, start + 20000, start).score).toBe(50);
  });

  test('does not award points for incorrect, invalid, or late answers', () => {
    const start = 100000;
    expect(getQuizAnswerResult(0, 1, start, start)).toMatchObject({
      correct: false, score: 0, late: false,
    });
    expect(getQuizAnswerResult(1, 1, start + 20001, start)).toMatchObject({
      correct: false, score: 0, late: true,
    });
    expect(getQuizAnswerResult(4, 1, start, start)).toMatchObject({
      correct: false, score: 0, late: true,
    });
  });
});

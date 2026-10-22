import { loadQuizAnswerKey, storeQuizAnswerKey } from './quizAnswerKey';

describe('Quiz answer key storage', () => {
  beforeEach(() => window.sessionStorage.clear());

  test('stores answer keys only in the current browser session', () => {
    const questions = [
      { question: 'First?', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
      { question: 'Second?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 },
    ];
    storeQuizAnswerKey('room-1', questions);
    expect(loadQuizAnswerKey('room-1', questions)).toEqual([2, 0]);
    expect(loadQuizAnswerKey('room-1', [
      { question: 'Different?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 },
    ])).toBeNull();
    expect(window.sessionStorage.getItem('room-1')).toBeNull();
  });

  test('rejects invalid answer keys', () => {
    expect(() => storeQuizAnswerKey('room-1', [{ correctIndex: 4 }]))
      .toThrow('Cannot store an invalid quiz answer key.');
    expect(loadQuizAnswerKey('missing-room')).toBeNull();
  });
});

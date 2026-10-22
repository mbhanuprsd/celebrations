import { toPublicQuizQuestions } from './quizConstants';

const storageKey = roomId => `celebrations.quizAnswerKey.${roomId}`;

export function storeQuizAnswerKey(roomId, questions) {
  const answers = questions.map(question => question.correctIndex);
  if (!roomId || answers.length === 0 ||
      answers.some(index => !Number.isInteger(index) || index < 0 || index > 3)) {
    throw new Error('Cannot store an invalid quiz answer key.');
  }
  window.sessionStorage.setItem(storageKey(roomId), JSON.stringify({
    answers,
    fingerprint: JSON.stringify(toPublicQuizQuestions(questions)),
  }));
}

export function loadQuizAnswerKey(roomId, questions) {
  if (!roomId) return null;
  const stored = window.sessionStorage.getItem(storageKey(roomId));
  if (!stored) return null;
  try {
    const { answers, fingerprint } = JSON.parse(stored);
    if (Array.isArray(answers) && answers.length > 0 &&
        answers.every(index => Number.isInteger(index) && index >= 0 && index <= 3) &&
        (!questions || fingerprint === JSON.stringify(toPublicQuizQuestions(questions)))) {
      return answers;
    }
  } catch {
    return null;
  }
  return null;
}

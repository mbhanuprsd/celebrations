jest.mock('firebase/firestore', () => ({
  deleteField: jest.fn(() => 'delete-field'),
  doc: jest.fn((_db, collection, id) => ({ collection, id })),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
}));
jest.mock('../../firebase', () => ({ db: {} }));
jest.mock('../../firebase/services', () => ({
  safeUpdateDoc: jest.fn(),
  sendSystemMessage: jest.fn(),
}));

import { runTransaction } from 'firebase/firestore';
import {
  advanceQuizQuestion,
  revealQuizAnswer,
  submitQuizAnswer,
} from './quizFirebaseService';

let room;
let updates;

function setupTransaction() {
  updates = [];
  runTransaction.mockImplementation(async (_db, callback) => callback({
    get: async () => ({
      exists: () => true,
      data: () => room,
    }),
    update: (_ref, value) => updates.push(value),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  const now = Date.now();
  room = {
    status: 'playing',
    quizState: {
      playerOrder: ['alice', 'bob'],
      questions: [{ question: 'Q?', options: ['A', 'B', 'C', 'D'] }],
      currentIndex: 0,
      phase: 'question',
      answers: {},
      scores: { alice: 0, bob: 0 },
      questionStartTime: now,
      questionStartServerTime: { toMillis: () => now },
    },
  };
  setupTransaction();
});

describe('Quiz Firebase service', () => {
  test('accepts one valid answer into the transactional answer map', async () => {
    await expect(submitQuizAnswer('room', 'alice', 1)).resolves.toEqual({ accepted: true });
    expect(updates).toHaveLength(1);
    expect(updates[0]['quizState.answers.alice']).toMatchObject({
      optionIndex: 1,
      questionIndex: 0,
    });
    expect(updates[0]['quizState.answers.alice']).toHaveProperty('submittedAt');
    expect(updates[0]).not.toHaveProperty('quizState.scores.alice');
  });

  test('rejects invalid options, nonplayers, and duplicate answers', async () => {
    await expect(submitQuizAnswer('room', 'alice', 4)).resolves.toMatchObject({ error: expect.any(String) });
    await expect(submitQuizAnswer('room', 'mallory', 1)).resolves.toMatchObject({ error: expect.any(String) });
    room.quizState.answers.alice = { optionIndex: 1 };
    await expect(submitQuizAnswer('room', 'alice', 1)).resolves.toMatchObject({ error: expect.any(String) });
    expect(updates).toHaveLength(0);
  });

  test('rejects answers after the question deadline', async () => {
    room.quizState.questionStartTime = Date.now() - 21000;
    await expect(submitQuizAnswer('room', 'alice', 1)).resolves.toMatchObject({ error: expect.any(String) });
    expect(updates).toHaveLength(0);
  });

  test('scores answers atomically when revealing and excludes late submissions', async () => {
    const startedAt = Date.now() - 5000;
    room.quizState.questionStartTime = startedAt;
    room.quizState.questionStartServerTime = { toMillis: () => startedAt };
    room.quizState.answers = {
      alice: { optionIndex: 2, submittedAt: { toMillis: () => startedAt + 2000 } },
      bob: { optionIndex: 2, submittedAt: { toMillis: () => startedAt + 21000 } },
    };

    await expect(revealQuizAnswer('room', 2, 0)).resolves.toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0]['quizState.answers'].alice).toMatchObject({
      correct: true, score: 900, late: false,
    });
    expect(updates[0]['quizState.answers'].bob).toMatchObject({
      correct: false, score: 0, late: true,
    });
    expect(updates[0]['quizState.scores']).toEqual({ alice: 900, bob: 0 });
    expect(updates[0]['quizState.revealedCorrectIndex']).toBe(2);
    expect(updates[0]['quizState.phase']).toBe('reveal');
  });

  test('does not reveal a stale answer key for a different question index', async () => {
    room.quizState.currentIndex = 1;
    await expect(revealQuizAnswer('room', 2, 0)).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });

  test('does not advance a question until its reveal phase', async () => {
    await advanceQuizQuestion('room');
    expect(updates).toHaveLength(0);
  });
});

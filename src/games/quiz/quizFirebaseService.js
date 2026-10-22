// src/games/quiz/quizFirebaseService.js
import { deleteField, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { safeUpdateDoc, sendSystemMessage } from '../../firebase/services';
import { getQuizAnswerResult, QUIZ_SETTINGS, toPublicQuizQuestions } from './quizConstants';
import { storeQuizAnswerKey } from './quizAnswerKey';

export async function initQuizGame(roomId, playerOrder, questions, topic) {
  if (!Array.isArray(playerOrder) || playerOrder.length < QUIZ_SETTINGS.minPlayers ||
      !Array.isArray(questions) || questions.length === 0) {
    throw new Error('Quiz requires players and at least one valid question.');
  }
  storeQuizAnswerKey(roomId, questions);
  const scores = {};
  playerOrder.forEach(uid => { scores[uid] = 0; });

  const publicQuestions = toPublicQuizQuestions(questions);

  const quizState = {
    playerOrder,
    questions: publicQuestions,
    topic,
    currentIndex: 0,
    phase: 'question',
    answers: {},
    scores,
    questionStartTime: Date.now(),
    questionStartServerTime: serverTimestamp(),
    winner: null,
  };

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    quizState,
    quizQuestions: publicQuestions,
  });
  await sendSystemMessage(roomId, `🧠 Quiz started! Topic: ${topic}. ${questions.length} questions!`);
}

/** Records one answer per player and question. The host scores answers at reveal time. */
export async function submitQuizAnswer(roomId, userId, optionIndex) {
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
    return { error: 'Choose a valid answer.' };
  }
  let result = { error: 'The question is no longer accepting answers.' };
  await runTransaction(db, async transaction => {
    const roomRef = doc(db, 'rooms', roomId);
    const snapshot = await transaction.get(roomRef);
    const room = snapshot.data();
    const q = room?.quizState;
    if (!snapshot.exists() || room.status !== 'playing' || !q || q.phase !== 'question') return;
    if (!q.playerOrder?.includes(userId)) {
      result = { error: 'You are not a player in this quiz.' };
      return;
    }
    if (q.answers?.[userId]) {
      result = { error: 'You already answered this question.' };
      return;
    }
    if (!Number.isInteger(q.currentIndex) || !q.questions?.[q.currentIndex]) {
      result = { error: 'The current question is invalid.' };
      return;
    }
    if (Date.now() > q.questionStartTime + QUIZ_SETTINGS.answerTime * 1000) {
      result = { error: 'Time is up for this question.' };
      return;
    }

    transaction.update(roomRef, {
      [`quizState.answers.${userId}`]: {
        optionIndex,
        questionIndex: q.currentIndex,
        submittedAt: serverTimestamp(),
      },
    });
    result = { accepted: true };
  });
  return result;
}

/** Scores submitted answers and reveals the answer in one atomic transition. */
export async function revealQuizAnswer(roomId, correctIndex, expectedIndex) {
  let revealed = false;
  await runTransaction(db, async transaction => {
    revealed = false;
    const roomRef = doc(db, 'rooms', roomId);
    const snapshot = await transaction.get(roomRef);
    const room = snapshot.data();
    const q = room?.quizState;
    if (!snapshot.exists() || room.status !== 'playing' || !q || q.phase !== 'question') return;
    if (q.currentIndex !== expectedIndex) return;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3 ||
        !q.questions?.[q.currentIndex]) {
      throw new Error('The answer key for this question is unavailable.');
    }

    const allAnswered = q.playerOrder.every(uid => q.answers?.[uid]);
    const timedOut = Date.now() >= q.questionStartTime + QUIZ_SETTINGS.answerTime * 1000;
    if (!allAnswered && !timedOut) return;

    const startMillis = q.questionStartServerTime?.toMillis?.() ?? q.questionStartTime;
    const answers = { ...(q.answers || {}) };
    const scores = { ...(q.scores || {}) };
    q.playerOrder.forEach(uid => {
      const answer = answers[uid];
      if (!answer) return;
      const submittedAt = answer.submittedAt?.toMillis?.() ?? answer.timestamp;
      const result = getQuizAnswerResult(
        answer.optionIndex,
        correctIndex,
        submittedAt,
        startMillis
      );
      answers[uid] = {
        ...answer,
        correct: result.correct,
        late: result.late,
        score: result.score,
      };
      scores[uid] = (scores[uid] || 0) + result.score;
    });

    transaction.update(roomRef, {
      'quizState.answers': answers,
      'quizState.scores': scores,
      'quizState.revealedCorrectIndex': correctIndex,
      'quizState.phase': 'reveal',
    });
    revealed = true;
  });
  return revealed;
}

/** Advances only from reveal, preventing stale timers from skipping questions. */
export async function advanceQuizQuestion(roomId) {
  let finishedMessage = null;
  await runTransaction(db, async transaction => {
    finishedMessage = null;
    const roomRef = doc(db, 'rooms', roomId);
    const snapshot = await transaction.get(roomRef);
    const room = snapshot.data();
    const q = room?.quizState;
    if (!snapshot.exists() || room.status !== 'playing' || !q || q.phase !== 'reveal') return;

    const nextIndex = q.currentIndex + 1;
    if (nextIndex >= q.questions.length) {
      const winner = q.playerOrder.reduce((currentWinner, uid) =>
        (q.scores?.[uid] || 0) > (q.scores?.[currentWinner] || 0) ? uid : currentWinner,
      q.playerOrder[0]);
      const winnerName = room.players?.[winner]?.name || 'Someone';
      const maxScore = q.scores?.[winner] || 0;
      transaction.update(roomRef, {
        'quizState.phase': 'finished',
        'quizState.winner': winner,
      });
      finishedMessage = `🏆 ${winnerName} wins with ${maxScore} points!`;
      return;
    }

    transaction.update(roomRef, {
      'quizState.currentIndex': nextIndex,
      'quizState.phase': 'question',
      'quizState.answers': {},
      'quizState.questionStartTime': Date.now(),
      'quizState.questionStartServerTime': serverTimestamp(),
      'quizState.revealedCorrectIndex': deleteField(),
    });
  });
  if (finishedMessage) await sendSystemMessage(roomId, finishedMessage);
}

export async function resetQuizGame(roomId, playerOrder, questions, topic) {
  await initQuizGame(roomId, playerOrder, questions, topic);
}

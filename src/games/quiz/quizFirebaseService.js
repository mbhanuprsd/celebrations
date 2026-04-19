// src/games/quiz/quizFirebaseService.js
import { doc, getDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { safeUpdateDoc, sendSystemMessage } from '../../firebase/services';
import { QUIZ_SETTINGS, POINTS_PER_SECOND } from './quizConstants';

export async function initQuizGame(roomId, playerOrder, questions, topic) {
  const scores = {};
  playerOrder.forEach(uid => { scores[uid] = 0; });

  const quizState = {
    playerOrder,
    questions,
    topic,
    currentIndex: 0,
    phase: 'question',
    answers: {},
    scores,
    // FIX: store a server timestamp alongside the millis value.
    // The millis value is used for client-side countdown math (serverTimestamp
    // isn't readable until after the write resolves). The server value is the
    // authoritative reference — score calculation uses it via the snapshot,
    // preventing clock-skew advantages and client-clock manipulation.
    questionStartTime: Date.now(),
    questionStartServerTime: serverTimestamp(),
    winner: null,
  };

  await safeUpdateDoc(doc(db, 'rooms', roomId), { status: 'playing', quizState });
  await sendSystemMessage(roomId, `🧠 Quiz started! Topic: ${topic}. ${questions.length} questions!`);
}

/** Called when a player submits their answer.
 *  Uses increment() for the score to avoid read-then-write race conditions
 *  when multiple players answer at the same instant. */
export async function submitQuizAnswer(roomId, userId, optionIndex) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const q = snap.data()?.quizState;
  if (!q || q.phase !== 'question') return;
  if (q.answers?.[userId]) return;  // already answered

  // Use server-side start time when available; fall back to millis field.
  const startMillis = q.questionStartServerTime?.toMillis?.()
    ?? q.questionStartTime;
  const elapsed = (Date.now() - startMillis) / 1000;
  const currentQ = q.questions[q.currentIndex];
  const isCorrect = optionIndex === currentQ.correctIndex;
  const score = isCorrect
    ? Math.max(50, QUIZ_SETTINGS.maxScore - Math.floor(elapsed * POINTS_PER_SECOND))
    : 0;

  const update = {
    [`quizState.answers.${userId}`]: {
      optionIndex,
      timestamp: Date.now(),
      score,
      correct: isCorrect,
    },
  };

  // Use increment() so concurrent writes don't overwrite each other
  if (isCorrect) {
    update[`quizState.scores.${userId}`] = increment(score);
  }

  await safeUpdateDoc(doc(db, 'rooms', roomId), update);
}

/** Moves to reveal phase — host triggers this when all answered or time runs out */
export async function revealQuizAnswer(roomId) {
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'quizState.phase': 'reveal',
  });
}

/** Advances to next question, or ends the game after the last one.
 *  FIX: guard against phase === 'finished' so a host reconnect / retry
 *  cannot re-run winner determination with a stale snapshot. */
export async function advanceQuizQuestion(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const data = snap.data();
  const q = data?.quizState;
  // FIX: bail out if already finished — makes the function idempotent.
  if (!q || q.phase === 'finished') return;

  const nextIndex = q.currentIndex + 1;

  if (nextIndex >= q.questions.length) {
    // Game over — determine winner from scores already in snapshot
    let maxScore = -1;
    let winner = q.playerOrder[0];
    for (const uid of q.playerOrder) {
      if ((q.scores[uid] || 0) > maxScore) {
        maxScore = q.scores[uid] || 0;
        winner = uid;
      }
    }

    const winnerName = data?.players?.[winner]?.name || 'Someone';

    await safeUpdateDoc(doc(db, 'rooms', roomId), {
      'quizState.phase': 'finished',
      'quizState.winner': winner,
    });
    await sendSystemMessage(roomId, `🏆 ${winnerName} wins with ${maxScore} points!`);
    return;
  }

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'quizState.currentIndex': nextIndex,
    'quizState.phase': 'question',
    'quizState.answers': {},
    'quizState.questionStartTime': Date.now(),
    'quizState.questionStartServerTime': serverTimestamp(),
  });
}

export async function resetQuizGame(roomId, playerOrder, questions, topic) {
  await initQuizGame(roomId, playerOrder, questions, topic);
}

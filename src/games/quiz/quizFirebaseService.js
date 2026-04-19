// src/games/quiz/quizFirebaseService.js
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { safeUpdateDoc, sendSystemMessage } from '../../firebase/services';
import { QUIZ_SETTINGS, POINTS_PER_SECOND } from './quizConstants';

export async function initQuizGame(roomId, playerOrder, questions, topic) {
  const scores = {};
  playerOrder.forEach(uid => { scores[uid] = 0; });

  const quizState = {
    playerOrder,
    questions,           // full array stored in Firestore
    topic,
    currentIndex: 0,
    phase: 'question',   // 'question' | 'reveal' | 'finished'
    answers: {},         // uid → { optionIndex, timestamp, score }
    scores,
    questionStartTime: Date.now(),
    winner: null,
  };

  await safeUpdateDoc(doc(db, 'rooms', roomId), { status: 'playing', quizState });
  await sendSystemMessage(roomId, `🧠 Quiz started! Topic: ${topic}. ${questions.length} questions!`);
}

/** Called when a player submits their answer */
export async function submitQuizAnswer(roomId, userId, optionIndex) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const q = snap.data()?.quizState;
  if (!q || q.phase !== 'question') return;
  // Don't let a player answer twice
  if (q.answers?.[userId]) return;

  const elapsed = (Date.now() - q.questionStartTime) / 1000;
  const currentQ = q.questions[q.currentIndex];
  const isCorrect = optionIndex === currentQ.correctIndex;
  const score = isCorrect
    ? Math.max(50, QUIZ_SETTINGS.maxScore - Math.floor(elapsed * POINTS_PER_SECOND))
    : 0;

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    [`quizState.answers.${userId}`]: { optionIndex, timestamp: Date.now(), score, correct: isCorrect },
    ...(isCorrect ? { [`quizState.scores.${userId}`]: (q.scores[userId] || 0) + score } : {}),
  });
}

/** Host calls this to move to reveal phase (or auto-trigger when all answered) */
export async function revealQuizAnswer(roomId) {
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'quizState.phase': 'reveal',
  });
}

/** Host calls this after reveal delay to advance to next question */
export async function advanceQuizQuestion(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const q = snap.data()?.quizState;
  if (!q) return;

  const nextIndex = q.currentIndex + 1;

  if (nextIndex >= q.questions.length) {
    // Game over — find winner
    let maxScore = -1;
    let winner = q.playerOrder[0];
    for (const uid of q.playerOrder) {
      if ((q.scores[uid] || 0) > maxScore) { maxScore = q.scores[uid]; winner = uid; }
    }
    await safeUpdateDoc(doc(db, 'rooms', roomId), {
      'quizState.phase': 'finished',
      'quizState.winner': winner,
    });
    const snap2 = await getDoc(doc(db, 'rooms', roomId));
    const winnerName = snap2.data()?.players?.[winner]?.name || 'Someone';
    await sendSystemMessage(roomId, `🏆 ${winnerName} wins with ${maxScore} points!`);
    return;
  }

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'quizState.currentIndex': nextIndex,
    'quizState.phase': 'question',
    'quizState.answers': {},
    'quizState.questionStartTime': Date.now(),
  });
}

export async function resetQuizGame(roomId, playerOrder, questions, topic) {
  await initQuizGame(roomId, playerOrder, questions, topic);
}

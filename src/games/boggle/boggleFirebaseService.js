import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import { BOGGLE_ROUND_SECONDS, calculateBoggleScores, createBoggleBoard, isWordOnBoard, normalizeBoggleRoundSeconds, parseBoggleDictionary } from './boggleConstants';

let dictionaryPromise;

export function loadBoggleDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = fetch(`${process.env.PUBLIC_URL || ''}/dictionaries/words.txt`)
      .then(response => {
        if (!response.ok) throw new Error(`Dictionary request failed (${response.status})`);
        return response.text();
      })
      .then(parseBoggleDictionary)
      .catch(error => {
        dictionaryPromise = null;
        throw error;
      });
  }
  return dictionaryPromise;
}

export async function initBoggleGame(roomId, playerOrder, minWordLength = 3, roundDuration = BOGGLE_ROUND_SECONDS) {
  const startedAt = Date.now();
  const minLength = Math.min(6, Math.max(3, Number(minWordLength) || 3));
  const durationSeconds = normalizeBoggleRoundSeconds(roundDuration);
  const scores = Object.fromEntries(playerOrder.map(uid => [uid, 0]));

  await runTransaction(db, async transaction => {
    const roomRef = doc(db, 'rooms', roomId);
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error('Room no longer exists.');
    transaction.update(roomRef, {
      status: 'playing',
      boggleState: {
        playerOrder,
        board: createBoggleBoard(),
        minWordLength: minLength,
        durationSeconds,
        startedAt,
        endsAt: startedAt + durationSeconds * 1000,
        phase: 'playing',
        submissions: {},
        scores,
      },
    });
  });
}

export async function submitBoggleWord(roomId, userId, rawWord, dictionary) {
  const word = rawWord.trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) return { error: 'Use letters A–Z only.' };

  let result = { error: 'The round has ended.' };
  await runTransaction(db, async transaction => {
    const roomRef = doc(db, 'rooms', roomId);
    const snapshot = await transaction.get(roomRef);
    const state = snapshot.data()?.boggleState;
    if (!state || state.phase !== 'playing' || Date.now() >= state.endsAt) return;
    if (!state.playerOrder.includes(userId)) {
      result = { error: 'You are not part of this round.' };
      return;
    }
    if (word.length < state.minWordLength) {
      result = { error: `Words must be at least ${state.minWordLength} letters.` };
      return;
    }
    if (!dictionary.has(word)) {
      result = { error: 'That word is not in the dictionary.' };
      return;
    }
    if (!isWordOnBoard(word, state.board)) {
      result = { error: 'That word cannot be traced on this board.' };
      return;
    }
    if (state.submissions?.[word]?.[userId]) {
      result = { error: 'You already found that word.' };
      return;
    }

    transaction.update(roomRef, {
      [`boggleState.submissions.${word}.${userId}`]: true,
    });
    result = { accepted: true, word };
  });
  return result;
}

export async function finishBoggleRound(roomId) {
  let finished = false;
  await runTransaction(db, async transaction => {
    finished = false;
    const roomRef = doc(db, 'rooms', roomId);
    const snapshot = await transaction.get(roomRef);
    const state = snapshot.data()?.boggleState;
    if (!state || state.phase !== 'playing' || Date.now() < state.endsAt) return;

    const scores = calculateBoggleScores(state.playerOrder, state.submissions);

    transaction.update(roomRef, {
      status: 'finished',
      'boggleState.phase': 'finished',
      'boggleState.scores': scores,
      'boggleState.finishedAt': Date.now(),
    });
    finished = true;
  });
  return finished;
}

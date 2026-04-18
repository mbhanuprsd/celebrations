// src/games/minigolf/minigolfFirebaseService.js
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { HOLES, MAX_STROKES } from './minigolfConstants';
import { sendSystemMessage , safeUpdateDoc } from '../../firebase/services';

export async function initMiniGolfGame(roomId, playerOrder) {
  const hole = HOLES[0];
  const balls = {};
  const scores = {};

  playerOrder.forEach((uid, i) => {
    balls[uid] = { x: hole.start.x, y: hole.start.y + i * 12, strokes: 0 };
    scores[uid] = [];                 // will fill in one entry per hole
  });

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    miniGolfState: {
      playerOrder,                    // ← was missing; caused the black screen
      currentIndex: 0,
      currentHoleIdx: 0,
      balls,
      scores,
      holeFinished: [],               // uids who have sunk this hole
      winner: null,
    },
  });
  await sendSystemMessage(roomId, '⛳ Mini Golf started! Lowest total strokes wins.');
}

/** Called when the active player finishes their shot (ball stopped or sunk).
 *  newX/newY = final ball position, strokes = total strokes this hole so far,
 *  sunk = true if ball went in the hole. */
export async function endShot(roomId, userId, newX, newY, strokes, sunk) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const data = snap.data();
  const u    = { ...data.miniGolfState };
  const playerOrder = u.playerOrder;
  const count = playerOrder.length;

  // ── Update ball position ────────────────────────────────────────────────
  const balls = { ...u.balls };
  balls[userId] = { ...balls[userId], x: newX, y: newY, strokes };

  let holeFinished = [...(u.holeFinished || [])];
  let scores       = { ...u.scores };
  let currentHoleIdx = u.currentHoleIdx;
  let winner       = u.winner;

  if (sunk || strokes >= MAX_STROKES) {
    // Record score for this hole
    const holeScore = sunk ? strokes : MAX_STROKES + 2; // +2 penalty for not sinking
    if (!holeFinished.includes(userId)) {
      holeFinished = [...holeFinished, userId];
      const existingScores = Array.isArray(scores[userId]) ? scores[userId] : [];
      scores = {
        ...scores,
        [userId]: [...existingScores, holeScore],
      };
    }
  }

  // ── Advance to next player who hasn't finished this hole ───────────────
  let nextIndex = u.currentIndex;
  let loops = 0;
  do {
    nextIndex = (nextIndex + 1) % count;
    loops++;
  } while (holeFinished.includes(playerOrder[nextIndex]) && loops <= count);

  // All players done with this hole?
  const allDone = playerOrder.every(uid => holeFinished.includes(uid));

  if (allDone) {
    const nextHole = currentHoleIdx + 1;

    if (nextHole >= HOLES.length) {
      // ── Game over — find winner (lowest total strokes) ─────────────────
      let minTotal = Infinity;
      let winnerUid = playerOrder[0];
      for (const uid of playerOrder) {
        const total = (scores[uid] || []).reduce((s, v) => s + v, 0);
        if (total < minTotal) { minTotal = total; winnerUid = uid; }
      }
      winner = winnerUid;

      await safeUpdateDoc(doc(db, 'rooms', roomId), {
        'miniGolfState.balls': balls,
        'miniGolfState.scores': scores,
        'miniGolfState.holeFinished': holeFinished,
        'miniGolfState.winner': winner,
        'miniGolfState.currentIndex': 0,
      });
      const winnerName = data.players?.[winnerUid]?.name || 'Someone';
      await sendSystemMessage(roomId, `🏆 ${winnerName} wins with ${minTotal} strokes!`);
      return;
    }

    // Reset for next hole
    const nextHoleData = HOLES[nextHole];
    const resetBalls = {};
    playerOrder.forEach((uid, i) => {
      resetBalls[uid] = { x: nextHoleData.start.x, y: nextHoleData.start.y + i * 12, strokes: 0 };
    });

    await safeUpdateDoc(doc(db, 'rooms', roomId), {
      'miniGolfState.currentHoleIdx': nextHole,
      'miniGolfState.currentIndex':   0,
      'miniGolfState.holeFinished':   [],
      'miniGolfState.balls':          resetBalls,
      'miniGolfState.scores':         scores,
    });
    await sendSystemMessage(roomId, `⛳ Hole ${nextHole + 1}: ${HOLES[nextHole].name}`);
    return;
  }

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'miniGolfState.balls':        balls,
    'miniGolfState.scores':       scores,
    'miniGolfState.holeFinished': holeFinished,
    'miniGolfState.currentIndex': nextIndex,
  });
}

export async function resetMiniGolfGame(roomId, playerOrder) {
  await initMiniGolfGame(roomId, playerOrder);
}

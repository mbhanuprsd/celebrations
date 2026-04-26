// src/games/minigolf/minigolfFirebaseService.js
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import { HOLES, MAX_STROKES } from './minigolfConstants';
import { sendSystemMessage, safeUpdateDoc } from '../../firebase/services';

export async function initMiniGolfGame(roomId, playerOrder) {
  const hole   = HOLES[0];
  const balls  = {};
  const scores = {};

  playerOrder.forEach((uid, i) => {
    balls[uid]  = { x: hole.start.x, y: hole.start.y + i * 12, strokes: 0 };
    scores[uid] = [];
  });

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    miniGolfState: {
      playerOrder,
      currentIndex: 0,
      currentHoleIdx: 0,
      balls,
      scores,
      holeFinished: [],
      winner: null,
    },
  });
  await sendSystemMessage(roomId, '⛳ Mini Golf started! Lowest total strokes wins.');
}

// FIX: wrapped in runTransaction to prevent duplicate shot submissions from double-tap / retry
export async function endShot(roomId, userId, newX, newY, strokes, sunk) {
  let postMsgs = [];

  await runTransaction(db, async (tx) => {
    postMsgs = [];
    const snap = await tx.get(doc(db, 'rooms', roomId));
    const data = snap.data();
    const u    = { ...data?.miniGolfState };
    if (!u.playerOrder) return;

    const playerOrder = u.playerOrder;
    const count       = playerOrder.length;

    const balls = { ...u.balls };
    balls[userId] = { ...balls[userId], x: newX, y: newY, strokes };

    let holeFinished   = [...(u.holeFinished || [])];
    let scores         = { ...u.scores };
    let currentHoleIdx = u.currentHoleIdx;
    let winner         = u.winner;

    if (sunk || strokes >= MAX_STROKES) {
      const holeScore = sunk ? strokes : MAX_STROKES + 2;
      if (!holeFinished.includes(userId)) {
        holeFinished = [...holeFinished, userId];
        const existing = Array.isArray(scores[userId]) ? scores[userId] : [];
        scores = { ...scores, [userId]: [...existing, holeScore] };
      }
    }

    let nextIdx = u.currentIndex;
    let loops = 0;
    do {
      nextIdx = (nextIdx + 1) % count;
      loops++;
    } while (holeFinished.includes(playerOrder[nextIdx]) && loops <= count);

    const allDone = playerOrder.every(uid => holeFinished.includes(uid));

    if (allDone) {
      const nextHole = currentHoleIdx + 1;

      if (nextHole >= HOLES.length) {
        let minTotal = Infinity;
        let winnerUid = playerOrder[0];
        for (const uid of playerOrder) {
          const total = (scores[uid] || []).reduce((s, v) => s + v, 0);
          if (total < minTotal) { minTotal = total; winnerUid = uid; }
        }
        winner = winnerUid;
        tx.update(doc(db, 'rooms', roomId), {
          'miniGolfState.balls':        balls,
          'miniGolfState.scores':       scores,
          'miniGolfState.holeFinished': holeFinished,
          'miniGolfState.winner':       winner,
          'miniGolfState.currentIndex': 0,
        });
        const winnerName = data.players?.[winnerUid]?.name || 'Someone';
        postMsgs.push(`🏆 ${winnerName} wins with ${minTotal} strokes!`);
        return;
      }

      const nextHoleData = HOLES[nextHole];
      const resetBalls   = {};
      playerOrder.forEach((uid, i) => {
        resetBalls[uid] = { x: nextHoleData.start.x, y: nextHoleData.start.y + i * 12, strokes: 0 };
      });

      tx.update(doc(db, 'rooms', roomId), {
        'miniGolfState.currentHoleIdx': nextHole,
        'miniGolfState.currentIndex':   0,
        'miniGolfState.holeFinished':   [],
        'miniGolfState.balls':          resetBalls,
        'miniGolfState.scores':         scores,
      });
      postMsgs.push(`⛳ Hole ${nextHole + 1}: ${HOLES[nextHole].name}`);
      return;
    }

    tx.update(doc(db, 'rooms', roomId), {
      'miniGolfState.balls':        balls,
      'miniGolfState.scores':       scores,
      'miniGolfState.holeFinished': holeFinished,
      'miniGolfState.currentIndex': nextIdx,
    });
  });

  for (const msg of postMsgs) await sendSystemMessage(roomId, msg).catch(console.error);
}

export async function resetMiniGolfGame(roomId, playerOrder) {
  await initMiniGolfGame(roomId, playerOrder);
}

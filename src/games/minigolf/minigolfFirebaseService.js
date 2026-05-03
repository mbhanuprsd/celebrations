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
    balls[uid]  = { x: hole.start.x, y: hole.start.y + i * 20, strokes: 0 };
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
      pendingShot: null,  // broadcast shot vector so all clients animate together
    },
  });
  await sendSystemMessage(roomId, '⛳ Mini Golf started! Lowest total strokes wins.');
}

// Write the shot vector to Firestore so every client can run physics and show the ball moving.
// A random shotId prevents re-triggering on the same update.
export async function fireShot(roomId, uid, fromX, fromY, angle, power, strokes) {
  const shotId = Math.random().toString(36).slice(2, 9);
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'miniGolfState.pendingShot': { uid, fromX, fromY, angle, power, strokes, shotId },
  });
}

// Called only by the shooter once physics finish on their device.
// Clears pendingShot and commits the final ball position + turn advance.
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
    } while (holeFinished.includes(playerOrder[nextIdx]) && loops < count);

    const allDone = playerOrder.every(uid => holeFinished.includes(uid));

    if (allDone) {
      const nextHole = currentHoleIdx + 1;

      if (nextHole >= HOLES.length) {
        // Game over — find winner
        let minTotal = Infinity;
        let winnerUid = playerOrder[0];
        for (const uid of playerOrder) {
          const total = (scores[uid] || []).reduce((s, v) => s + v, 0);
          if (total < minTotal) { minTotal = total; winnerUid = uid; }
        }
        const tiedUids = playerOrder.filter(uid =>
          (scores[uid] || []).reduce((s, v) => s + v, 0) === minTotal
        );
        winner = winnerUid;
        tx.update(doc(db, 'rooms', roomId), {
          'miniGolfState.balls':        balls,
          'miniGolfState.scores':       scores,
          'miniGolfState.holeFinished': holeFinished,
          'miniGolfState.winner':       winner,
          'miniGolfState.currentIndex': 0,
          'miniGolfState.pendingShot':  null,
        });
        if (tiedUids.length > 1) {
          const tiedNames = tiedUids.map(uid => data.players?.[uid]?.name || uid).join(' & ');
          postMsgs.push(`🤝 Tie! ${tiedNames} both finished with ${minTotal} strokes! ${data.players?.[winnerUid]?.name || winnerUid} wins by turn order.`);
        } else {
          const winnerName = data.players?.[winnerUid]?.name || 'Someone';
          postMsgs.push(`🏆 ${winnerName} wins with ${minTotal} strokes!`);
        }
        return;
      }

      // Advance to next hole
      const nextHoleData = HOLES[nextHole];
      const resetBalls   = {};
      playerOrder.forEach((uid, i) => {
        resetBalls[uid] = { x: nextHoleData.start.x, y: nextHoleData.start.y + i * 20, strokes: 0 };
      });
      tx.update(doc(db, 'rooms', roomId), {
        'miniGolfState.currentHoleIdx': nextHole,
        'miniGolfState.currentIndex':   0,
        'miniGolfState.holeFinished':   [],
        'miniGolfState.balls':          resetBalls,
        'miniGolfState.scores':         scores,
        'miniGolfState.pendingShot':    null,
      });
      postMsgs.push(`⛳ Hole ${nextHole + 1}: ${HOLES[nextHole].name}`);
      return;
    }

    // Normal turn advance
    tx.update(doc(db, 'rooms', roomId), {
      'miniGolfState.balls':        balls,
      'miniGolfState.scores':       scores,
      'miniGolfState.holeFinished': holeFinished,
      'miniGolfState.currentIndex': nextIdx,
      'miniGolfState.pendingShot':  null,
    });
  });

  for (const msg of postMsgs) await sendSystemMessage(roomId, msg).catch(console.error);
}

export async function resetMiniGolfGame(roomId, playerOrder) {
  await initMiniGolfGame(roomId, playerOrder);
}

export async function skipTurn(roomId) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(doc(db, 'rooms', roomId));
    const u = snap.data()?.miniGolfState;
    if (!u?.playerOrder) return;

    const { playerOrder, currentIndex, holeFinished } = u;
    const count = playerOrder.length;
    let nextIdx = currentIndex;
    let loops = 0;
    do {
      nextIdx = (nextIdx + 1) % count;
      loops++;
    } while (holeFinished.includes(playerOrder[nextIdx]) && loops < count);

    tx.update(doc(db, 'rooms', roomId), {
      'miniGolfState.currentIndex': nextIdx,
      'miniGolfState.pendingShot':  null,
    });
  });
  await sendSystemMessage(roomId, '⏭️ Host skipped a disconnected player\'s turn.').catch(console.error);
}
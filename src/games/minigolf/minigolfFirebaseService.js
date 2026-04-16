// src/games/minigolf/minigolfFirebaseService.js
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { HOLES } from './minigolfConstants';
import { sendSystemMessage } from '../../firebase/services';

export async function initMiniGolfGame(roomId, playerOrder) {
  const hole = HOLES[0];
  const balls = {};
  
  playerOrder.forEach((uid, index) => {
    balls[uid] = {
      x: hole.startPos.x + (index * 10),
      y: hole.startPos.y,
      vx: 0,
      vy: 0,
      strokes: 0,
      finished: false,
    };
  });

  const miniGolfState = {
    currentHoleIdx: 0,
    balls,
    currentIndex: 0,
    direction: 1,
    winner: null,
    lastAction: null,
  };

  await updateDoc(doc(db, 'rooms', roomId), { 
    status: 'playing', 
    miniGolfState 
  });
  await sendSystemMessage(roomId, `⛳ Mini Golf started! First to sink the ball wins.`);
}

export async function moveBall(roomId, userId, vx, vy) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const u = snap.data().miniGolfState;
  
  if (u.playerOrder[u.currentIndex] !== userId) throw new Error('Not your turn');
  
  const ball = u.balls[userId];
  ball.vx = vx;
  ball.vy = vy;
  ball.strokes += 1;

  await updateDoc(doc(db, 'rooms', roomId), {
    'miniGolfState.balls': u.balls,
    'miniGolfState.lastAction': { type: 'hit', uid: userId },
  });
}

export async function endTurn(roomId, userId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const u = snap.data().miniGolfState;
  const count = u.playerOrder.length;
  
  const nextIdx = ((u.currentIndex + u.direction) % count + count) % count;
  
  await updateDoc(doc(db, 'rooms', roomId), {
    'miniGolfState.currentIndex': nextIdx,
  });
}

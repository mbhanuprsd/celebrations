// src/games/snakeladder/snakeLadderFirebaseService.js
import { doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { assignPlayerColors, applyEffect, BOARD_SIZE } from './snakeLadderConstants';
import { sendSystemMessage, safeUpdateDoc } from '../../firebase/services';

export async function initSnakeLadderGame(roomId, playerIds) {
  const colorMap = assignPlayerColors(playerIds);
  const positions = {};
  playerIds.forEach(id => { positions[id] = 0; });

  const slState = {
    colorMap, positions,
    playerOrder: playerIds,
    currentTurnIndex: 0,
    diceValue: null, diceRolled: false,
    winner: null, lastEffect: null,
    lastMoveInfo: null,
    turnCount: 0, rankings: [],
  };

  await safeUpdateDoc(doc(db, 'rooms', roomId), { status: 'playing', slState });
  await sendSystemMessage(roomId, '🎲 Snake & Ladder started! First turn begins.');
}

// FIX: wrapped in runTransaction to prevent double-roll from double-tap / retry
export async function rollSnakeDice(roomId, userId) {
  let result = {};

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(doc(db, 'rooms', roomId));
    const sl = snap.data()?.slState;
    if (!sl) { result = { error: 'No game state' }; return; }

    if (sl.playerOrder[sl.currentTurnIndex] !== userId) { result = { error: 'Not your turn' }; return; }
    if (sl.diceRolled) { result = { error: 'Already rolled' }; return; }
    if (sl.winner)     { result = { error: 'Game over' }; return; }

    const value = Math.floor(Math.random() * 6) + 1;
    tx.update(doc(db, 'rooms', roomId), {
      'slState.diceValue': value,
      'slState.diceRolled': true,
    });
    result = { value };
  });

  return result;
}

// FIX: wrapped in runTransaction to prevent duplicate moves from double-tap / retry
export async function moveSnakePiece(roomId, userId) {
  let result = {};
  let postMsgs = [];

  await runTransaction(db, async (tx) => {
    postMsgs = [];
    const snap = await tx.get(doc(db, 'rooms', roomId));
    const sl = snap.data()?.slState;
    if (!sl) { result = { error: 'No game state' }; return; }

    if (sl.playerOrder[sl.currentTurnIndex] !== userId) { result = { error: 'Not your turn' }; return; }
    if (!sl.diceRolled) { result = { error: 'Roll dice first' }; return; }

    const fromPos    = sl.positions[userId] || 0;
    const diceValue  = sl.diceValue;
    let preEffectPos = fromPos + diceValue;

    if (preEffectPos > BOARD_SIZE) {
      preEffectPos = BOARD_SIZE - (preEffectPos - BOARD_SIZE);
    }

    const effect   = applyEffect(preEffectPos);
    const finalPos = effect.newPos;

    const newPositions = { ...sl.positions, [userId]: finalPos };
    const won = finalPos === BOARD_SIZE;

    let newRankings = [...(sl.rankings || [])];
    if (won && !newRankings.includes(userId)) newRankings.push(userId);

    const activePlayers = sl.playerOrder.filter(id => !newRankings.includes(id));
    const gameOver = activePlayers.length <= 1;

    let nextIndex = sl.currentTurnIndex;
    if (!gameOver) {
      const idx        = activePlayers.indexOf(sl.playerOrder[sl.currentTurnIndex]);
      const nextPlayer = activePlayers[(idx + 1) % activePlayers.length];
      nextIndex        = sl.playerOrder.indexOf(nextPlayer);
      if (nextIndex === -1) nextIndex = 0;
    }

    const newTurnCount = sl.turnCount + 1;
    const lastMoveInfo = { playerId: userId, fromPos, preEffectPos, finalPos, effectType: effect.type || null, moveId: newTurnCount };

    const updates = {
      'slState.positions':        newPositions,
      'slState.diceValue':        null,
      'slState.diceRolled':       false,
      'slState.lastEffect':       effect.type ? { ...effect, playerId: userId } : null,
      'slState.lastMoveInfo':     lastMoveInfo,
      'slState.currentTurnIndex': nextIndex,
      'slState.turnCount':        newTurnCount,
      'slState.rankings':         newRankings,
    };

    if (gameOver) {
      if (activePlayers.length === 1 && !newRankings.includes(activePlayers[0])) {
        newRankings.push(activePlayers[0]);
        updates['slState.rankings'] = newRankings;
      }
      updates['slState.winner'] = newRankings[0];
      updates['status'] = 'finished';
    }

    tx.update(doc(db, 'rooms', roomId), updates);

    if (effect.type === 'ladder') postMsgs.push(`🪜 Ladder! ${preEffectPos} → ${finalPos}`);
    else if (effect.type === 'snake') postMsgs.push(`🐍 Snake! ${preEffectPos} → ${finalPos}`);
    if (won)      postMsgs.push(`🏆 Finished at #${newRankings.length}!`);
    if (gameOver) postMsgs.push('🎉 Game over!');

    result = { fromPos, preEffectPos, finalPos, effectType: effect.type, won, gameOver };
  });

  for (const msg of postMsgs) await sendSystemMessage(roomId, msg).catch(console.error);

  return result;
}

export async function resetSnakeLadderGame(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const sl = snap.data()?.slState;
  if (!sl) return;
  const freshPositions = {};
  sl.playerOrder.forEach(id => { freshPositions[id] = 0; });
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    status: 'waiting',
    'slState.positions':        freshPositions,
    'slState.currentTurnIndex': 0,
    'slState.diceValue':        null,
    'slState.diceRolled':       false,
    'slState.winner':           null,
    'slState.lastEffect':       null,
    'slState.lastMoveInfo':     null,
    'slState.turnCount':        0,
    'slState.rankings':         [],
  });
}

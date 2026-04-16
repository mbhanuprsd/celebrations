// src/games/snakeladder/snakeLadderFirebaseService.js
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { assignPlayerColors, applyEffect, BOARD_SIZE } from './snakeLadderConstants';
import { sendSystemMessage } from '../../firebase/services';

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
    // lastMoveInfo drives client-side animation on every player's screen
    lastMoveInfo: null,
    turnCount: 0, rankings: [],
  };

  await updateDoc(doc(db, 'rooms', roomId), { status: 'playing', slState });
  await sendSystemMessage(roomId, `🎲 Snake & Ladder started! First turn begins.`);
}

export async function rollSnakeDice(roomId, userId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const sl = snap.data().slState;

  if (sl.playerOrder[sl.currentTurnIndex] !== userId) return { error: 'Not your turn' };
  if (sl.diceRolled) return { error: 'Already rolled' };
  if (sl.winner) return { error: 'Game over' };

  const value = Math.floor(Math.random() * 6) + 1;
  await updateDoc(doc(db, 'rooms', roomId), {
    'slState.diceValue': value,
    'slState.diceRolled': true,
  });
  return { value };
}

export async function moveSnakePiece(roomId, userId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const sl = snap.data().slState;

  if (sl.playerOrder[sl.currentTurnIndex] !== userId) return { error: 'Not your turn' };
  if (!sl.diceRolled) return { error: 'Roll dice first' };

  const fromPos = sl.positions[userId] || 0;
  const diceValue = sl.diceValue;
  let preEffectPos = fromPos + diceValue;

  // Bounce back if overshoot
  if (preEffectPos > BOARD_SIZE) {
    preEffectPos = BOARD_SIZE - (preEffectPos - BOARD_SIZE);
  }

  const effect = applyEffect(preEffectPos);
  const finalPos = effect.newPos;

  const newPositions = { ...sl.positions, [userId]: finalPos };
  const won = finalPos === BOARD_SIZE;

  let newRankings = [...(sl.rankings || [])];
  if (won && !newRankings.includes(userId)) newRankings.push(userId);

  const activePlayers = sl.playerOrder.filter(id => !newRankings.includes(id));
  const gameOver = activePlayers.length <= 1;

  let nextIndex = sl.currentTurnIndex;
  if (!gameOver) {
    const idx = activePlayers.indexOf(sl.playerOrder[sl.currentTurnIndex]);
    const nextPlayer = activePlayers[(idx + 1) % activePlayers.length];
    nextIndex = sl.playerOrder.indexOf(nextPlayer);
    if (nextIndex === -1) nextIndex = 0;
  }

  const newTurnCount = sl.turnCount + 1;

  // lastMoveInfo is read by every client's board to trigger smooth animation
  const lastMoveInfo = {
    playerId: userId,
    fromPos,
    preEffectPos,
    finalPos,
    effectType: effect.type || null,
    moveId: newTurnCount,
  };

  const updates = {
    'slState.positions': newPositions,
    'slState.diceValue': null,
    'slState.diceRolled': false,
    'slState.lastEffect': effect.type ? { ...effect, playerId: userId } : null,
    'slState.lastMoveInfo': lastMoveInfo,
    'slState.currentTurnIndex': nextIndex,
    'slState.turnCount': newTurnCount,
    'slState.rankings': newRankings,
  };

  if (gameOver) {
    if (activePlayers.length === 1 && !newRankings.includes(activePlayers[0])) {
      newRankings.push(activePlayers[0]);
      updates['slState.rankings'] = newRankings;
    }
    updates['slState.winner'] = newRankings[0];
    updates['status'] = 'finished';
  }

  await updateDoc(doc(db, 'rooms', roomId), updates);

  if (effect.type === 'ladder') await sendSystemMessage(roomId, `🪜 Ladder! ${preEffectPos} → ${finalPos}`);
  else if (effect.type === 'snake') await sendSystemMessage(roomId, `🐍 Snake! ${preEffectPos} → ${finalPos}`);
  if (won) await sendSystemMessage(roomId, `🏆 Finished at #${newRankings.length}!`);
  if (gameOver) await sendSystemMessage(roomId, `🎉 Game over!`);

  return { fromPos, preEffectPos, finalPos, effectType: effect.type, won, gameOver };
}

export async function resetSnakeLadderGame(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const sl = snap.data()?.slState;
  if (!sl) return;
  const freshPositions = {};
  sl.playerOrder.forEach(id => { freshPositions[id] = 0; });
  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'waiting',
    'slState.positions': freshPositions,
    'slState.currentTurnIndex': 0,
    'slState.diceValue': null,
    'slState.diceRolled': false,
    'slState.winner': null,
    'slState.lastEffect': null,
    'slState.lastMoveInfo': null,
    'slState.turnCount': 0,
    'slState.rankings': [],
  });
}

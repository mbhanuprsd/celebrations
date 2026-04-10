// src/games/snakeladder/snakeLadderFirebaseService.js
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { assignPlayerColors, applyEffect, BOARD_SIZE } from './snakeLadderConstants';
import { sendSystemMessage } from '../../firebase/services';

// ─── Init Game ─────────────────────────────────────────────────────────────

export async function initSnakeLadderGame(roomId, playerIds) {
  const colorMap = assignPlayerColors(playerIds); // { uid: colorId }

  const positions = {};
  playerIds.forEach(id => { positions[id] = 0; }); // 0 = not yet on board

  const slState = {
    colorMap,           // { userId: colorId }
    positions,          // { userId: cellNumber }  0 = start
    playerOrder: playerIds,
    currentTurnIndex: 0,
    diceValue: null,
    diceRolled: false,
    winner: null,
    lastEffect: null,   // { type: 'snake'|'ladder', from, to, playerId }
    turnCount: 0,
    rankings: [],       // players who finished in order
  };

  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    slState,
  });

  const firstId = playerIds[0];
  await sendSystemMessage(roomId, `🎲 Snake & Ladder started! ${firstId} goes first.`);
}

// ─── Roll Dice ─────────────────────────────────────────────────────────────

export async function rollSnakeDice(roomId, userId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const room = snap.data();
  const sl = room.slState;

  const currentPlayerId = sl.playerOrder[sl.currentTurnIndex];
  if (currentPlayerId !== userId) return { error: 'Not your turn' };
  if (sl.diceRolled) return { error: 'Already rolled' };
  if (sl.winner) return { error: 'Game over' };

  const value = Math.floor(Math.random() * 6) + 1;

  await updateDoc(doc(db, 'rooms', roomId), {
    'slState.diceValue': value,
    'slState.diceRolled': true,
  });

  return { value };
}

// ─── Move Piece ────────────────────────────────────────────────────────────

export async function moveSnakePiece(roomId, userId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const room = snap.data();
  const sl = room.slState;

  const currentPlayerId = sl.playerOrder[sl.currentTurnIndex];
  if (currentPlayerId !== userId) return { error: 'Not your turn' };
  if (!sl.diceRolled) return { error: 'Roll dice first' };

  const currentPos = sl.positions[userId] || 0;
  const diceValue = sl.diceValue;
  let newPos = currentPos + diceValue;

  // Bounce back if overshoot
  if (newPos > BOARD_SIZE) {
    newPos = BOARD_SIZE - (newPos - BOARD_SIZE);
  }

  // Apply snake or ladder
  const effect = applyEffect(newPos);
  const finalPos = effect.newPos;

  // Build updated positions
  const newPositions = { ...sl.positions, [userId]: finalPos };

  // Check win
  const won = finalPos === BOARD_SIZE;

  let newRankings = [...(sl.rankings || [])];
  if (won && !newRankings.includes(userId)) {
    newRankings.push(userId);
  }

  // Remaining active players (not yet won)
  const activePlayers = sl.playerOrder.filter(id => !newRankings.includes(id));

  // Check all done
  const gameOver = activePlayers.length <= 1;

  // Advance turn
  let nextIndex = sl.currentTurnIndex;
  if (!gameOver) {
    const currentActiveIdx = activePlayers.indexOf(currentPlayerId);
    const nextActivePlayer = activePlayers[(currentActiveIdx + 1) % activePlayers.length];
    nextIndex = sl.playerOrder.indexOf(nextActivePlayer);
    if (nextIndex === -1) nextIndex = 0;
  }

  const updates = {
    'slState.positions': newPositions,
    'slState.diceValue': null,
    'slState.diceRolled': false,
    'slState.lastEffect': effect.type ? { ...effect, playerId: userId } : null,
    'slState.currentTurnIndex': nextIndex,
    'slState.turnCount': sl.turnCount + 1,
    'slState.rankings': newRankings,
  };

  if (gameOver) {
    // Add last remaining player to rankings
    if (activePlayers.length === 1 && !newRankings.includes(activePlayers[0])) {
      newRankings.push(activePlayers[0]);
      updates['slState.rankings'] = newRankings;
    }
    updates['slState.winner'] = newRankings[0];
    updates['status'] = 'finished';
  }

  await updateDoc(doc(db, 'rooms', roomId), updates);

  // System messages
  if (effect.type === 'ladder') {
    await sendSystemMessage(roomId, `🪜 ${userId} climbed a ladder! ${effect.from} → ${effect.to}`);
  } else if (effect.type === 'snake') {
    await sendSystemMessage(roomId, `🐍 ${userId} got bitten! ${effect.from} → ${effect.to}`);
  }
  if (won) {
    await sendSystemMessage(roomId, `🏆 ${userId} reached 100 and finished #${newRankings.length}!`);
  }
  if (gameOver) {
    await sendSystemMessage(roomId, `🎉 Game over! Winner: ${newRankings[0]}`);
  }

  return { finalPos, effect: effect.type, won, gameOver };
}

// ─── Reset ─────────────────────────────────────────────────────────────────

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
    'slState.turnCount': 0,
    'slState.rankings': [],
  });
}

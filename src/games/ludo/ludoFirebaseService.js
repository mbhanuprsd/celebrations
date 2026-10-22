// src/games/ludo/ludoFirebaseService.js
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  COLOR_ORDER, TOTAL_STEPS,
  assignColors, getMainPathIndex, canCapture, getPieceDestination,
  getMovablePieceIds, getNextLudoColor,
} from './ludoConstants';
import { sendSystemMessage, safeUpdateDoc } from '../../firebase/services';

// ─── Initial State Builder ─────────────────────────────────────────────────

function makePieces() {
  return [
    { id: 0, step: -1 },
    { id: 1, step: -1 },
    { id: 2, step: -1 },
    { id: 3, step: -1 },
  ];
}

export async function initLudoGame(roomId, playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length < 2 || playerIds.length > COLOR_ORDER.length ||
      new Set(playerIds).size !== playerIds.length) {
    throw new Error('Ludo requires 2–4 unique players.');
  }
  const colorMap = assignColors(playerIds);   // { uid: 'red', ... }
  const activeColors = playerIds.map(id => colorMap[id]);

  const pieces = {};
  COLOR_ORDER.forEach(color => {
    pieces[color] = makePieces();
  });

  const ludoState = {
    pieces,
    colorMap,                       // { userId: colorName }
    activeColors,                   // ['red','blue'] etc.
    currentTurn: activeColors[0],   // first active color
    diceValue: null,
    diceRolled: false,
    consecutiveSixes: 0,
    winner: null,
    winnerUid: null,                // FIX: store uid so player lookup works
    rankings: [],                   // FIX: ordered list of uids as they finish
    lastMove: null,
    turnCount: 0,
  };

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    ludoState,
  });

  await sendSystemMessage(roomId, `🎲 Ludo started! ${activeColors[0].toUpperCase()} goes first.`);
}

// ─── Dice Roll ─────────────────────────────────────────────────────────────
// FIX: wrapped in runTransaction to prevent double-roll from double-tap / retry

export async function rollDice(roomId, userId) {
  let result = {};

  await runTransaction(db, async (tx) => {
    const roomRef = doc(db, 'rooms', roomId);
    const snap = await tx.get(roomRef);
    if (!snap.exists()) { result = { error: 'Room no longer exists.' }; return; }
    const room = snap.data();
    const ls = room?.ludoState;
    if (room.status !== 'playing' || !ls) {
      result = { error: 'The Ludo game is not active.' };
      return;
    }

    const myColor = ls.colorMap?.[userId];
    if (!myColor || !ls.activeColors?.includes(myColor)) {
      result = { error: 'You are not part of this game.' };
      return;
    }
    if (ls.currentTurn !== myColor) { result = { error: 'Not your turn' }; return; }
    if (ls.diceRolled)              { result = { error: 'Already rolled' }; return; }
    if (ls.winner)                  { result = { error: 'Game over' };      return; }

    const value = Math.floor(Math.random() * 6) + 1;

    const movable = getMovablePieceIds(ls.pieces?.[myColor], value);
    const noMoves = movable.length === 0;

    const newConsecSixes = value === 6 ? ls.consecutiveSixes + 1 : 0;
    const forcedSkip = newConsecSixes >= 3;

    const updates = {
      'ludoState.diceValue': value,
      'ludoState.diceRolled': true,
      'ludoState.consecutiveSixes': forcedSkip ? 0 : newConsecSixes,
    };

    if (noMoves || forcedSkip) {
      const nextColor = getNextLudoColor(myColor, ls.activeColors);
      if (!nextColor) {
        result = { error: 'Invalid Ludo turn order.' };
        return;
      }
      updates['ludoState.currentTurn'] = nextColor;
      updates['ludoState.diceValue']   = null;
      updates['ludoState.diceRolled']  = false;
      updates['ludoState.consecutiveSixes'] = 0;
    }

    tx.update(roomRef, updates);
    // Return both result and color to avoid extra getDoc after transaction
    result = { value, movable, noMoves, forcedSkip, color: myColor };
  });

  // System messages outside transaction (Firestore transactions cannot call other async ops)
  // Use color from result to avoid redundant getDoc call
  if (result.noMoves && !result.forcedSkip) {
    await sendSystemMessage(roomId,
      `🎲 ${result.color?.toUpperCase()} rolled ${result.value} — no valid moves, turn skipped.`);
  } else if (result.forcedSkip) {
    await sendSystemMessage(roomId,
      `🎲 ${result.color?.toUpperCase()} rolled three 6s — turn forfeited!`);
  }

  return result;
}

// ─── Move Piece ────────────────────────────────────────────────────────────
// FIX: wrapped in runTransaction to prevent duplicate moves from double-tap / retry

export async function movePiece(roomId, userId, pieceId) {
  let result = {};
  let postMoveMessages = [];

  await runTransaction(db, async (tx) => {
    postMoveMessages = [];

    const roomRef = doc(db, 'rooms', roomId);
    const snap = await tx.get(roomRef);
    if (!snap.exists()) { result = { error: 'Room no longer exists.' }; return; }
    const room = snap.data();
    const ls = room?.ludoState;
    if (room.status !== 'playing' || !ls) {
      result = { error: 'The Ludo game is not active.' };
      return;
    }

    const myColor = ls.colorMap?.[userId];
    if (!myColor || !ls.activeColors?.includes(myColor)) {
      result = { error: 'You are not part of this game.' };
      return;
    }
    if (ls.winner)                  { result = { error: 'Game over' }; return; }
    if (ls.currentTurn !== myColor) { result = { error: 'Not your turn' }; return; }
    if (!ls.diceRolled)             { result = { error: 'Roll dice first' }; return; }

    const piece = ls.pieces?.[myColor]?.find(p => p.id === pieceId);
    if (!piece) { result = { error: 'Invalid piece' }; return; }

    const diceValue = ls.diceValue;
    const fromStep = piece.step;
    const toStep = getPieceDestination(fromStep, diceValue);
    if (fromStep === -1 && diceValue !== 6) {
      result = { error: 'Need 6 to enter' };
      return;
    }
    if (fromStep >= TOTAL_STEPS) {
      result = { error: 'Piece already won' };
      return;
    }
    if (toStep === null) {
      result = { error: 'Overshoots center or invalid move.' };
      return;
    }

    const newPieces = { ...ls.pieces };
    newPieces[myColor] = newPieces[myColor].map(p =>
      p.id === pieceId ? { ...p, step: toStep } : p
    );

    let captureMsg = null;

    // Check captures (only on main path steps 0–51)
    if (toStep < 52 && toStep >= 0) {
      const mainIdx = getMainPathIndex(myColor, toStep);
      if (mainIdx >= 0) {
        for (const otherColor of ls.activeColors) {
          if (otherColor === myColor) continue;
          const captured = newPieces[otherColor].filter(p => {
            if (p.step < 0 || p.step >= 52) return false;
            const otherMainIdx = getMainPathIndex(otherColor, p.step);
            return otherMainIdx === mainIdx && canCapture(myColor, otherColor, mainIdx);
          });
          if (captured.length > 0) {
            newPieces[otherColor] = newPieces[otherColor].map(p =>
              captured.find(c => c.id === p.id) ? { ...p, step: -1 } : p
            );
            captureMsg = `💥 ${myColor.toUpperCase()} sent ${otherColor.toUpperCase()}'s piece home!`;
          }
        }
      }
    }

    // Check win — all 4 pieces reached center
    const allWon = newPieces[myColor].every(p => p.step >= TOTAL_STEPS);

    const getAnotherTurn = (diceValue === 6 || captureMsg !== null) && !allWon;

    const lastMove = { color: myColor, pieceId, from: fromStep, to: toStep };

    const updates = {
      'ludoState.pieces': newPieces,
      'ludoState.diceValue': null,
      'ludoState.diceRolled': false,
      'ludoState.lastMove': lastMove,
      'ludoState.turnCount': ls.turnCount + 1,
    };

    if (allWon) {
      // FIX: store both color (for UI coloring) and uid (for player lookup)
      const newRankings = [...(ls.rankings || []), userId];
      const allFinished = newRankings.length >= ls.activeColors.length;

      updates['ludoState.rankings'] = newRankings;

      if (allFinished || newRankings.length === 1) {
        // First finisher ends the game
        updates['ludoState.winner']    = myColor;
        updates['ludoState.winnerUid'] = userId;
        updates['status']              = 'finished';
      }
    } else if (!getAnotherTurn) {
      const nextColor = getNextLudoColor(myColor, ls.activeColors);
      if (!nextColor) {
        result = { error: 'Invalid Ludo turn order.' };
        return;
      }
      updates['ludoState.currentTurn'] = nextColor;
      updates['ludoState.consecutiveSixes'] = 0;
    }

    tx.update(roomRef, updates);

    // Queue messages to send after transaction commits
    if (captureMsg)         postMoveMessages.push(captureMsg);
    if (toStep >= TOTAL_STEPS) postMoveMessages.push(`🏠 ${myColor.toUpperCase()} got a piece home!`);
    if (allWon)             postMoveMessages.push(`🏆 ${myColor.toUpperCase()} wins the game!`);
    else if (getAnotherTurn) postMoveMessages.push(`🎲 ${myColor.toUpperCase()} gets another turn!`);

    result = { success: true, toStep, captured: !!captureMsg, won: allWon, anotherTurn: getAnotherTurn };
  });

  // Send system messages after transaction completes
  for (const msg of postMoveMessages) {
    await sendSystemMessage(roomId, msg).catch(console.error);
  }

  return result;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// ─── Reset Ludo ────────────────────────────────────────────────────────────
// FIX: explicitly clear winnerUid and rankings so stale data never leaks

export async function resetLudoGame(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const ls = snap.data()?.ludoState;
  if (!ls) return;

  const freshPieces = {};
  COLOR_ORDER.forEach(c => { freshPieces[c] = makePieces(); });

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    status: 'waiting',
    'ludoState.pieces': freshPieces,
    'ludoState.currentTurn': ls.activeColors[0],
    'ludoState.diceValue': null,
    'ludoState.diceRolled': false,
    'ludoState.consecutiveSixes': 0,
    'ludoState.winner': null,
    'ludoState.winnerUid': null,   // FIX: clear uid
    'ludoState.rankings': [],      // FIX: clear rankings
    'ludoState.lastMove': null,
    'ludoState.turnCount': 0,
  });
}

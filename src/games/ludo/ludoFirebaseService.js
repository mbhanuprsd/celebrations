// src/games/ludo/ludoFirebaseService.js
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  COLOR_ORDER, TOTAL_STEPS,
  assignColors, getMainPathIndex, canCapture
} from './ludoConstants';
import { sendSystemMessage , safeUpdateDoc } from '../../firebase/services';

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
    lastMove: null,                 // { color, pieceId, from, to } for animation
    turnCount: 0,
  };

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    status: 'playing',
    ludoState,
  });

  await sendSystemMessage(roomId, `🎲 Ludo started! ${activeColors[0].toUpperCase()} goes first.`);
}

// ─── Dice Roll ─────────────────────────────────────────────────────────────

export async function rollDice(roomId, userId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const room = snap.data();
  const ls = room.ludoState;

  const myColor = ls.colorMap[userId];
  if (ls.currentTurn !== myColor) return { error: 'Not your turn' };
  if (ls.diceRolled) return { error: 'Already rolled' };
  if (ls.winner) return { error: 'Game over' };

  const value = Math.floor(Math.random() * 6) + 1;

  // Check if any move is possible with this value
  const movable = getMovablePieceIds(myColor, ls.pieces[myColor], value);
  const noMoves = movable.length === 0;

  const newConsecSixes = value === 6 ? ls.consecutiveSixes + 1 : 0;
  const forcedSkip = newConsecSixes >= 3; // 3 consecutive sixes = lose turn

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'ludoState.diceValue': value,
    'ludoState.diceRolled': true,
    'ludoState.consecutiveSixes': forcedSkip ? 0 : newConsecSixes,
  });

  // Auto-advance turn if no valid moves or forced skip
  if (noMoves || forcedSkip) {
    const msg = forcedSkip
      ? `🎲 ${ls.colorMap[userId]?.toUpperCase()} rolled three 6s — turn forfeited!`
      : `🎲 ${myColor.toUpperCase()} rolled ${value} — no valid moves, turn skipped.`;
    await sendSystemMessage(roomId, msg);
    await advanceTurn(roomId, myColor, ls.activeColors, false);
  }

  return { value, movable, noMoves, forcedSkip };
}

// ─── Move Piece ────────────────────────────────────────────────────────────

export async function movePiece(roomId, userId, pieceId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const room = snap.data();
  const ls = room.ludoState;

  const myColor = ls.colorMap[userId];
  if (ls.currentTurn !== myColor) return { error: 'Not your turn' };
  if (!ls.diceRolled) return { error: 'Roll dice first' };

  const piece = ls.pieces[myColor].find(p => p.id === pieceId);
  if (!piece) return { error: 'Invalid piece' };

  const diceValue = ls.diceValue;

  // Validate move
  if (piece.step === -1 && diceValue !== 6) return { error: 'Need 6 to enter' };
  if (piece.step === TOTAL_STEPS) return { error: 'Piece already won' };

  const fromStep = piece.step;
  const toStep = piece.step === -1 ? 0 : Math.min(piece.step + diceValue, TOTAL_STEPS);

  if (toStep > TOTAL_STEPS) return { error: 'Overshoots center' };

  // Build updated pieces
  const newPieces = { ...ls.pieces };
  newPieces[myColor] = newPieces[myColor].map(p =>
    p.id === pieceId ? { ...p, step: toStep } : p
  );

  let captureMsg = null;

  // Check captures (only on main path steps 0-51)
  if (toStep < 52 && toStep >= 0) {
    const mainIdx = getMainPathIndex(myColor, toStep);
    if (mainIdx >= 0) {
      // Check all other active colors
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

  // Check win
  const allWon = newPieces[myColor].every(p => p.step >= TOTAL_STEPS);

  // Determine if same player gets another turn (rolled 6 OR captured a piece)
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
    updates['ludoState.winner'] = myColor;
    updates['status'] = 'finished';
  } else if (!getAnotherTurn) {
    const nextColor = getNextColor(myColor, ls.activeColors);
    updates['ludoState.currentTurn'] = nextColor;
    updates['ludoState.consecutiveSixes'] = 0;
  }

  await safeUpdateDoc(doc(db, 'rooms', roomId), updates);

  // System messages
  if (captureMsg) await sendSystemMessage(roomId, captureMsg);
  if (toStep >= TOTAL_STEPS) {
    await sendSystemMessage(roomId, `🏠 ${myColor.toUpperCase()} got a piece home!`);
  }
  if (allWon) {
    await sendSystemMessage(roomId, `🏆 ${myColor.toUpperCase()} wins the game!`);
  } else if (getAnotherTurn) {
    await sendSystemMessage(roomId, `🎲 ${myColor.toUpperCase()} gets another turn!`);
  }

  return { success: true, toStep, captured: !!captureMsg, won: allWon, anotherTurn: getAnotherTurn };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function getMovablePieceIds(color, pieces, diceValue) {
  return pieces
    .filter(p => {
      if (p.step >= TOTAL_STEPS) return false;             // already won
      if (p.step === -1) return diceValue === 6;            // need 6 to enter
      const newStep = p.step + diceValue;
      return newStep <= TOTAL_STEPS;                         // can't overshoot
    })
    .map(p => p.id);
}

async function advanceTurn(roomId, currentColor, activeColors, anotherTurn) {
  if (anotherTurn) return; // same player goes again
  const nextColor = getNextColor(currentColor, activeColors);
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'ludoState.currentTurn': nextColor,
    'ludoState.diceValue': null,
    'ludoState.diceRolled': false,
    'ludoState.consecutiveSixes': 0,
  });
}

function getNextColor(current, activeColors) {
  const idx = activeColors.indexOf(current);
  return activeColors[(idx + 1) % activeColors.length];
}

// ─── Reset Ludo ────────────────────────────────────────────────────────────

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
    'ludoState.lastMove': null,
    'ludoState.turnCount': 0,
  });
}

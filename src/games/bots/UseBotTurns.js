// src/games/bots/useBotTurns.js
//
// Single hook that watches game state and fires bot actions when it's a bot's turn.
// Only the HOST client runs bot logic — everyone else ignores this hook.
//
// Supported games: snakeladder, ludo, uno, minigolf, quiz
//
import { useEffect, useRef } from 'react';
import { rollSnakeDice, moveSnakePiece } from '../snakeladder/snakeLadderFirebaseService';
import { rollDice, movePiece, getMovablePieceIds } from '../ludo/ludoFirebaseService';
import { playUnoCard, drawUnoCard } from '../uno/unoFirebaseService';
import { fireShot } from '../minigolf/minigolfFirebaseService';
import { submitQuizAnswer } from '../quiz/quizFirebaseService';
import { HOLES } from '../minigolf/minigolfConstants';
import { canPlayCard, PLAYABLE_COLORS } from '../uno/unoConstants';

// ── Helpers ──────────────────────────────────────────────────────────────────

const delay = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => min + Math.random() * (max - min);

// Ludo: pick the best movable piece
// Strategy: prefer pieces already on the board, then furthest step
function pickLudoPiece(movableIds, piecesForColor) {
  if (!movableIds?.length) return null;
  const sorted = [...movableIds].sort((a, b) => {
    const pa = piecesForColor.find(p => p.id === a);
    const pb = piecesForColor.find(p => p.id === b);
    if (!pa || !pb) return 0;
    // Pieces on board (step >= 0) first, then furthest step
    if ((pa.step < 0) !== (pb.step < 0)) return pa.step < 0 ? 1 : -1;
    return pb.step - pa.step;
  });
  return sorted[0];
}

// UNO: pick the best playable card
// Strategy: action cards of active color > number match > other actions > wild > wild4
function pickBestUnoCard(playable, activeColor) {
  const colorAction = playable.find(c =>
    c.color === activeColor && ['skip', 'reverse', 'draw2'].includes(c.type));
  if (colorAction) return colorAction;

  const colorNum = playable.find(c => c.color === activeColor && c.type === 'number');
  if (colorNum) return colorNum;

  const anyAction = playable.find(c => !['wild', 'wild4'].includes(c.type));
  if (anyAction) return anyAction;

  const wild = playable.find(c => c.type === 'wild');
  if (wild) return wild;

  return playable[0];
}

// UNO: pick the color to declare on a wild (most represented color in hand)
function pickBestUnoColor(hand) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach(c => { if (counts[c.color] !== undefined) counts[c.color]++; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'red';
}

// ── Main Hook ─────────────────────────────────────────────────────────────────

export function useBotTurns({ room, roomId, isHost, gameType }) {
  // Track which action keys have already been handled to prevent double-firing
  const handledRef  = useRef(new Set());
  const timersRef   = useRef([]);

  // Clear scheduled timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isHost || !room || !roomId) return;

    const players  = room.players || {};
    const isBot    = uid => !!players[uid]?.isBot;

    const schedule = (fn, ms = 0) => {
      const t = setTimeout(() => fn().catch(console.error), ms);
      timersRef.current.push(t);
    };

    const handle = (key, fn, ms) => {
      if (handledRef.current.has(key)) return;
      handledRef.current.add(key);
      schedule(fn, ms);
    };

    // ── Snake & Ladder ────────────────────────────────────────────────────
    if (gameType === 'snakeladder') {
      const sl = room.slState;
      if (!sl || sl.winner) return;
      const currentUid = sl.playerOrder?.[sl.currentTurnIndex];
      if (!currentUid || !isBot(currentUid)) return;
      if (sl.diceRolled) return; // already rolled, shouldn't happen

      handle(`sl-${sl.turnCount}-${currentUid}`, async () => {
        await delay(rand(700, 1200));
        await rollSnakeDice(roomId, currentUid);
        await delay(rand(500, 900));
        await moveSnakePiece(roomId, currentUid);
      });
    }

    // ── Ludo ─────────────────────────────────────────────────────────────
    else if (gameType === 'ludo') {
      const ls = room.ludoState;
      if (!ls || ls.winner) return;
      if (ls.diceRolled) return;

      const currentUid = Object.entries(ls.colorMap || {})
        .find(([, color]) => color === ls.currentTurn)?.[0];
      if (!currentUid || !isBot(currentUid)) return;

      const color = ls.colorMap[currentUid];

      handle(`ludo-${ls.turnCount}-${currentUid}`, async () => {
        await delay(rand(700, 1200));
        const result = await rollDice(roomId, currentUid);
        if (result?.movable?.length > 0) {
          await delay(rand(500, 900));
          const pieces    = ls.pieces[color] || [];
          const pieceId   = pickLudoPiece(result.movable, pieces);
          if (pieceId != null) await movePiece(roomId, currentUid, pieceId);
        }
      });
    }

    // ── UNO ──────────────────────────────────────────────────────────────
    else if (gameType === 'uno') {
      const u = room.unoState;
      if (!u || u.winner) return;
      const currentUid = u.playerOrder?.[u.currentIndex];
      if (!currentUid || !isBot(currentUid)) return;

      handle(`uno-${u.turnCount}-${currentUid}`, async () => {
        await delay(rand(900, 1800));
        const hand     = u.hands?.[currentUid] || [];
        const playable = hand.filter(c =>
          canPlayCard(c, u.topCard, u.activeColor, u.pendingDraw, u.pendingDrawType));

        if (playable.length > 0) {
          const card = pickBestUnoCard(playable, u.activeColor);
          const isWild = card.type === 'wild' || card.type === 'wild4';
          const chosenColor = isWild ? pickBestUnoColor(hand) : null;
          await playUnoCard(roomId, currentUid, card.id, chosenColor);
        } else {
          await drawUnoCard(roomId, currentUid);
        }
      });
    }

    // ── Mini Golf ─────────────────────────────────────────────────────────
    else if (gameType === 'minigolf') {
      const mg = room.miniGolfState;
      if (!mg || mg.winner || mg.pendingShot) return;

      const currentUid = mg.playerOrder?.[mg.currentIndex];
      if (!currentUid || !isBot(currentUid)) return;
      if (mg.holeFinished?.includes(currentUid)) return;

      const ball = mg.balls?.[currentUid];
      if (!ball) return;

      const shotKey = `golf-${mg.currentHoleIdx}-${ball.strokes}-${currentUid}`;

      handle(shotKey, async () => {
        await delay(rand(1000, 1800));

        // Re-read ball to make sure it hasn't changed (another player went)
        const currentMg = room.miniGolfState;
        if (!currentMg || currentMg.pendingShot) return;
        if (currentMg.playerOrder?.[currentMg.currentIndex] !== currentUid) return;

        const holeData = HOLES[mg.currentHoleIdx] || HOLES[0];
        const holePos  = holeData.hole;

        // Aim toward hole with ±12° random variance
        // Note: fireShot stores angle such that vx = -cos(angle)*power
        // So to shoot TOWARD hole we need angle = atan2(dy,dx) + PI
        const dx        = holePos.x - ball.x;
        const dy        = holePos.y - ball.y;
        const toHole    = Math.atan2(dy, dx);
        const angle     = toHole + Math.PI + (Math.random() - 0.5) * 0.42; // ±12°
        const dist      = Math.hypot(dx, dy);
        const power     = Math.min(22, Math.max(8, dist / 14 + rand(-2, 3)));
        const newStrokes = ball.strokes + 1;

        await fireShot(roomId, currentUid, ball.x, ball.y, angle, power, newStrokes);
      });
    }

    // ── Quiz ─────────────────────────────────────────────────────────────
    else if (gameType === 'quiz') {
      const q = room.quizState;
      if (!q || q.phase !== 'question') return;

      const answerTime  = room.settings?.answerTime || 20;
      const currentQ    = q.questions?.[q.currentIndex];
      const optionCount = currentQ?.options?.length || 4;

      // Schedule an answer for each bot that hasn't answered this question yet
      for (const uid of Object.keys(players)) {
        if (!isBot(uid)) continue;
        if (q.answers?.[uid]) continue;

        const key = `quiz-${q.currentIndex}-${uid}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);

        // Answer somewhere between 30–85% of the answer window
        const delayMs = rand(answerTime * 300, answerTime * 850);
        const t = setTimeout(async () => {
          try {
            // Check phase is still active before answering
            const phase = room.quizState?.phase;
            if (phase !== 'question') return;
            if (room.quizState?.answers?.[uid]) return;
            const idx = Math.floor(Math.random() * optionCount);
            await submitQuizAnswer(roomId, uid, idx);
          } catch (e) {
            console.error('Bot quiz answer failed:', e);
          }
        }, delayMs);
        timersRef.current.push(t);
      }
    }

  }, [
    isHost, roomId, gameType,
    // Granular deps to avoid re-running on unrelated changes
    room?.slState?.turnCount, room?.slState?.winner,
    room?.ludoState?.turnCount, room?.ludoState?.winner,
    room?.unoState?.turnCount, room?.unoState?.winner,
    room?.miniGolfState?.pendingShot, room?.miniGolfState?.currentIndex,
    room?.miniGolfState?.currentHoleIdx, room?.miniGolfState?.winner,
    room?.quizState?.currentIndex, room?.quizState?.phase,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(room?.quizState?.answers),
  ]);
}
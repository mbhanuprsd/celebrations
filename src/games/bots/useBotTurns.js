// src/games/bots/useBotTurns.js
//
// Single hook that watches game state and fires bot actions when it's a bot's turn.
// Only the HOST client runs bot logic — everyone else ignores this hook.
//
// Supported games: snakeladder, ludo, uno, minigolf, quiz
//
import { useEffect, useRef } from 'react';
import { rollSnakeDice, moveSnakePiece } from '../snakeladder/snakeLadderFirebaseService';
import { rollDice, movePiece } from '../ludo/ludoFirebaseService';
import { playUnoCard, drawUnoCard } from '../uno/unoFirebaseService';
import { fireShot } from '../minigolf/minigolfFirebaseService';
import { submitQuizAnswer } from '../quiz/quizFirebaseService';
import { HOLES } from '../minigolf/minigolfConstants';
import { canPlayCard } from '../uno/unoConstants';

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
  const handledRef = useRef(new Set());
  const timersRef  = useRef([]);
  // Always-current room reference so delayed callbacks never read stale closures
  const roomRef    = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

  // ── Reset handledRef when the game resets (turnCount/currentIndex goes back to 0)
  // so bots act normally on rematch without unmounting the component.
  const resetSignal = [
    room?.slState?.turnCount     === 0 ? 'sl0'   : null,
    room?.ludoState?.turnCount   === 0 ? 'lu0'   : null,
    room?.unoState?.turnCount    === 0 ? 'un0'   : null,
    room?.miniGolfState?.currentHoleIdx === 0 &&
    room?.miniGolfState?.currentIndex   === 0 ? 'mg0' : null,
    room?.quizState?.currentIndex === 0 &&
    room?.quizState?.phase === 'question' ? 'qz0' : null,
  ].join('|');

  const prevResetSignalRef = useRef(resetSignal);
  useEffect(() => {
    if (prevResetSignalRef.current !== resetSignal) {
      prevResetSignalRef.current = resetSignal;
      handledRef.current = new Set();
    }
  }, [resetSignal]);

  const quizAnswerKeys = Object.keys(room?.quizState?.answers || {}).join(',');

  // Clear scheduled timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isHost || !room || !roomId) return;

    const players = room.players || {};
    const isBot   = uid => !!players[uid]?.isBot;

    // Schedule a bot action; prune completed timer IDs to keep array small
    const schedule = (fn, ms = 0) => {
      let id;
      id = setTimeout(() => {
        fn().catch(console.error);
        timersRef.current = timersRef.current.filter(t => t !== id);
      }, ms);
      timersRef.current.push(id);
    };

    const handle = (key, fn, ms = 0) => {
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
      if (sl.diceRolled) return;

      handle(`sl-${sl.turnCount}-${currentUid}`, async () => {
        await delay(rand(700, 1200));
        const freshSl = room.slState;
        if (!freshSl || freshSl.winner) return;
        const freshUid = freshSl.playerOrder?.[freshSl.currentTurnIndex];
        if (freshUid !== currentUid || freshSl.diceRolled) return;

        await rollSnakeDice(roomId, currentUid);
        await delay(rand(500, 900));

        const freshSlAfter = room.slState;
        if (!freshSlAfter || freshSlAfter.winner) return;
        const freshUidAfter = freshSlAfter.playerOrder?.[freshSlAfter.currentTurnIndex];
        if (freshUidAfter !== currentUid || !freshSlAfter.diceRolled) return;

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
        const freshLs = room.ludoState;
        if (!freshLs || freshLs.winner) return;
        if (freshLs.currentTurn !== color || freshLs.diceRolled) return;

        const result = await rollDice(roomId, currentUid);
        if (result?.movable?.length > 0) {
          await delay(rand(500, 900));
          const freshLsAfter = room.ludoState;
          if (!freshLsAfter || freshLsAfter.winner) return;
          if (freshLsAfter.currentTurn !== color || !freshLsAfter.diceRolled) return;

          const pieces  = freshLsAfter.pieces?.[color] || ls.pieces[color] || [];
          const pieceId = pickLudoPiece(result.movable, pieces);
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
        const freshU = room.unoState;
        if (!freshU || freshU.winner) return;
        const freshUid = freshU.playerOrder?.[freshU.currentIndex];
        if (freshUid !== currentUid) return;

        const hand = freshU.hands?.[currentUid] || [];
        const playable = hand.filter(c =>
          canPlayCard(c, freshU.topCard, freshU.activeColor, freshU.pendingDraw, freshU.pendingDrawType));

        if (playable.length > 0) {
          const card = pickBestUnoCard(playable, freshU.activeColor);
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

        // For minigolf, use current room since effect re-runs on room changes
        const freshMg = room.miniGolfState;
        if (!freshMg || freshMg.pendingShot || freshMg.winner) return;
        if (freshMg.playerOrder?.[freshMg.currentIndex] !== currentUid) return;
        if (freshMg.holeFinished?.includes(currentUid)) return;

        const freshBall = freshMg.balls?.[currentUid];
        if (!freshBall) return;

        const holeData = HOLES[freshMg.currentHoleIdx] || HOLES[0];
        const holePos  = holeData.hole;

        const dx = holePos.x - freshBall.x;
        const dy = holePos.y - freshBall.y;
        const dist = Math.hypot(dx, dy);

        // Smarter aiming: less random variation for close shots
        const baseAngle = Math.atan2(dy, dx) + Math.PI;
        const angleVariation = dist < 100 ? 0.1 : dist < 200 ? 0.3 : 0.5; // Reduced variation
        const angle = baseAngle + (Math.random() - 0.5) * angleVariation;

        // Better power calculation: account for friction and target speed
        // Mini golf balls need about 3-5 units of velocity to reach the hole
        const targetSpeed = Math.max(3, Math.min(8, dist / 25));
        const power = Math.min(22, Math.max(5, targetSpeed + rand(-1, 2)));

        await fireShot(roomId, currentUid, freshBall.x, freshBall.y, angle, power, freshBall.strokes + 1);
      });
    }

    // ── Quiz ─────────────────────────────────────────────────────────────
    else if (gameType === 'quiz') {
      const q = room.quizState;
      if (!q || q.phase !== 'question') return;

      const answerTime  = room.settings?.answerTime || 20;
      const questionIdx = q.currentIndex;
      const optionCount = q.questions?.[questionIdx]?.options?.length || 4;

      for (const uid of Object.keys(players)) {
        if (!isBot(uid)) continue;
        if (q.answers?.[uid]) continue;

        const key = `quiz-${questionIdx}-${uid}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);

        const delayMs = rand(answerTime * 300, answerTime * 850);
        let id;
        id = setTimeout(async () => {
          timersRef.current = timersRef.current.filter(t => t !== id);
          try {
            // Read freshest state from room — avoids stale closure
            const freshQ = room.quizState;
            if (!freshQ || freshQ.phase !== 'question') return;
            if (freshQ.currentIndex !== questionIdx) return; // question already moved on
            if (freshQ.answers?.[uid]) return;
            await submitQuizAnswer(roomId, uid, Math.floor(Math.random() * optionCount));
          } catch (e) {
            console.error('Bot quiz answer failed:', e);
          }
        }, delayMs);
        timersRef.current.push(id);
      }
    }

  }, [
    isHost, room, roomId, gameType,
    room?.slState?.turnCount,      room?.slState?.winner,
    room?.slState?.currentTurnIndex, room?.slState?.diceRolled,
    room?.ludoState?.turnCount,    room?.ludoState?.winner,
    room?.ludoState?.currentTurn,  room?.ludoState?.diceRolled,
    room?.unoState?.turnCount,     room?.unoState?.winner,
    room?.unoState?.currentIndex,
    room?.miniGolfState?.pendingShot, room?.miniGolfState?.currentIndex,
    room?.miniGolfState?.currentHoleIdx, room?.miniGolfState?.winner,
    room?.quizState?.currentIndex, room?.quizState?.phase,
    quizAnswerKeys,
  ]);
}
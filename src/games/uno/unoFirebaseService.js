// src/games/uno/unoFirebaseService.js
import { doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { buildDeck, shuffleArray, canPlayCard, nextIndex } from './unoConstants';
import { sendSystemMessage, safeUpdateDoc } from '../../firebase/services';

const HAND_SIZE = 7;

// ─── Helpers ───────────────────────────────────────────────────────────────

function recheckDeck(deck, discardPile) {
  if (deck.length > 0) return { deck, discardPile };
  if (discardPile.length <= 1) return { deck, discardPile };
  const top = discardPile[discardPile.length - 1];
  const newDeck = shuffleArray(discardPile.slice(0, -1));
  return { deck: newDeck, discardPile: [top] };
}

function dealCards(deck, playerIds) {
  const hands = {};
  playerIds.forEach(id => { hands[id] = []; });
  let d = [...deck];
  for (let i = 0; i < HAND_SIZE; i++) {
    playerIds.forEach(id => { if (d.length) hands[id].push(d.shift()); });
  }
  return { hands, deck: d };
}

function drawCards(count, deck, discardPile) {
  let d = [...deck];
  let dp = [...discardPile];
  const drawn = [];
  for (let i = 0; i < count; i++) {
    const refilled = recheckDeck(d, dp);
    d = refilled.deck; dp = refilled.discardPile;
    if (d.length) drawn.push(d.shift());
  }
  return { drawn, deck: d, discardPile: dp };
}

// ─── Init ──────────────────────────────────────────────────────────────────

export async function initUnoGame(roomId, playerOrder) {
  let deck = shuffleArray(buildDeck());
  const { hands, deck: remaining } = dealCards(deck, playerOrder);

  let startIdx = remaining.findIndex(c => c.color !== 'wild');
  if (startIdx === -1) startIdx = 0;
  const topCard  = remaining[startIdx];
  const restDeck = remaining.filter((_, i) => i !== startIdx);

  let currentIndex = 0;
  let direction    = 1;
  let pendingDraw  = 0;
  let pendingDrawType = null;
  const count = playerOrder.length;

  if (topCard.type === 'reverse') {
    direction = -1;
    currentIndex = count === 2 ? 0 : count - 1;
  } else if (topCard.type === 'skip') {
    currentIndex = nextIndex(0, direction, count);
  } else if (topCard.type === 'draw2') {
    pendingDraw = 2; pendingDrawType = 'draw2'; currentIndex = 0;
  }

  const unoState = {
    deck: restDeck, discardPile: [topCard], topCard,
    activeColor: topCard.color, hands, playerOrder,
    currentIndex, direction, pendingDraw, pendingDrawType,
    rankings: [], winner: null, turnCount: 0, lastAction: null,
  };

  await safeUpdateDoc(doc(db, 'rooms', roomId), { status: 'playing', unoState });
  await sendSystemMessage(roomId, `🃏 UNO started! ${playerOrder.length} players. Good luck!`);
  if (topCard.type === 'reverse') await sendSystemMessage(roomId, '↺ First card is Reverse!');
  if (topCard.type === 'skip')    await sendSystemMessage(roomId, '⊘ First card is Skip!');
  if (topCard.type === 'draw2')   await sendSystemMessage(roomId, '✋ First card is +2!');
}

// ─── Play Card ─────────────────────────────────────────────────────────────
// FIX: wrapped in runTransaction to prevent duplicate plays from double-tap / retry

export async function playUnoCard(roomId, userId, cardId, chosenColor = null) {
  let result = {};
  let postMsgs = [];
  let playerName = '';

  await runTransaction(db, async (tx) => {
    postMsgs = [];
    const snap = await tx.get(doc(db, 'rooms', roomId));
    const room = snap.data();
    const u    = room?.unoState;
    if (!u) { result = { error: 'No game state' }; return; }

    playerName = room.players?.[userId]?.name || 'Someone';

    if (u.winner) { result = { error: 'Game over' }; return; }
    if (u.playerOrder[u.currentIndex] !== userId) { result = { error: 'Not your turn' }; return; }

    const hand    = u.hands[userId] || [];
    const cardIdx = hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) { result = { error: 'Card not in hand' }; return; }
    const card = hand[cardIdx];

    if (!canPlayCard(card, u.topCard, u.activeColor, u.pendingDraw, u.pendingDrawType)) {
      result = { error: 'Cannot play that card' }; return;
    }
    if ((card.type === 'wild' || card.type === 'wild4') && !chosenColor) {
      result = { error: 'Choose a color first' }; return;
    }

    const count           = u.playerOrder.length;
    const newHand         = hand.filter((_, i) => i !== cardIdx);
    const newDiscardPile  = [...(u.discardPile || []), card];
    const newActiveColor  = chosenColor || card.color;

    let newDirection = u.direction;
    let skip = false;
    if (card.type === 'reverse') { newDirection = -u.direction; if (count === 2) skip = true; }
    if (card.type === 'skip') skip = true;

    let newPendingDraw = 0, newPendingDrawType = null;
    if (card.type === 'draw2')  { newPendingDraw = (u.pendingDraw || 0) + 2; newPendingDrawType = 'draw2'; }
    if (card.type === 'wild4')  { newPendingDraw = (u.pendingDraw || 0) + 4; newPendingDrawType = 'wild4'; }

    const newHands     = { ...u.hands, [userId]: newHand };
    let newRankings    = [...(u.rankings || [])];
    const finished     = newHand.length === 0;
    if (finished && !newRankings.includes(userId)) newRankings.push(userId);

    const remainingActive = u.playerOrder.filter(
      id => (id === userId ? newHand.length > 0 : (u.hands[id]?.length || 0) > 0) && !newRankings.includes(id)
    );
    const gameOver = remainingActive.length <= 1;
    if (gameOver && remainingActive.length === 1 && !newRankings.includes(remainingActive[0])) {
      newRankings.push(remainingActive[0]);
    }

    const nextIdx = nextIndex(u.currentIndex, newDirection, count, skip);

    const updates = {
      'unoState.deck':            u.deck,
      'unoState.discardPile':     newDiscardPile,
      'unoState.topCard':         card,
      'unoState.activeColor':     newActiveColor,
      'unoState.hands':           newHands,
      'unoState.direction':       newDirection,
      'unoState.pendingDraw':     newPendingDraw,
      'unoState.pendingDrawType': newPendingDrawType,
      'unoState.currentIndex':    nextIdx,
      'unoState.rankings':        newRankings,
      'unoState.turnCount':       (u.turnCount || 0) + 1,
      'unoState.lastAction':      { type: 'play', uid: userId, card, chosenColor },
    };
    if (gameOver) { updates['unoState.winner'] = newRankings[0]; updates['status'] = 'finished'; }

    tx.update(doc(db, 'rooms', roomId), updates);

    if (card.type === 'wild4')   postMsgs.push(`🎨 ${playerName} played Wild+4 → ${chosenColor}! Pending: ${newPendingDraw}`);
    else if (card.type === 'wild')    postMsgs.push(`🎨 ${playerName} played Wild → ${chosenColor}!`);
    else if (card.type === 'draw2')   postMsgs.push(`✋ ${playerName} played +2! Pending: ${newPendingDraw}`);
    else if (card.type === 'skip')    postMsgs.push(`⊘ ${playerName} played Skip!`);
    else if (card.type === 'reverse') postMsgs.push(`↺ ${playerName} reversed direction!`);

    if (newHand.length === 1) postMsgs.push(`⚠️ ${playerName} has UNO!`);
    if (finished)             postMsgs.push(`🎉 ${playerName} finished at #${newRankings.length}!`);
    if (gameOver)             postMsgs.push(`🏆 Game over! ${playerName} wins!`);

    result = { ok: true };
  });

  for (const msg of postMsgs) await sendSystemMessage(roomId, msg).catch(console.error);
  return result;
}

// ─── Draw Card ─────────────────────────────────────────────────────────────
// FIX: wrapped in runTransaction to prevent duplicate draws from double-tap / retry

export async function drawUnoCard(roomId, userId) {
  let result = {};
  let postMsgs = [];

  await runTransaction(db, async (tx) => {
    postMsgs = [];
    const snap = await tx.get(doc(db, 'rooms', roomId));
    const room = snap.data();
    const u    = room?.unoState;
    if (!u) { result = { error: 'No game state' }; return; }

    if (u.winner) { result = { error: 'Game over' }; return; }
    if (u.playerOrder[u.currentIndex] !== userId) { result = { error: 'Not your turn' }; return; }

    const count      = u.playerOrder.length;
    const drawCount  = (u.pendingDraw || 0) > 0 ? u.pendingDraw : 1;
    const hadPending = (u.pendingDraw || 0) > 0;

    const { drawn, deck: newDeck, discardPile: newDiscard } = drawCards(drawCount, u.deck, u.discardPile);
    const newHand  = [...(u.hands[userId] || []), ...drawn];
    const nextIdx  = nextIndex(u.currentIndex, u.direction, count);

    tx.update(doc(db, 'rooms', roomId), {
      'unoState.deck':              newDeck,
      'unoState.discardPile':       newDiscard,
      [`unoState.hands.${userId}`]: newHand,
      'unoState.currentIndex':      nextIdx,
      'unoState.pendingDraw':       0,
      'unoState.pendingDrawType':   null,
      'unoState.turnCount':         (u.turnCount || 0) + 1,
      'unoState.lastAction':        { type: 'draw', uid: userId, count: drawCount },
    });

    if (hadPending) {
      const pName = room.players?.[userId]?.name || 'Someone';
      postMsgs.push(`📥 ${pName} drew ${drawCount} cards (penalty)!`);
    }

    result = { ok: true, drew: drawCount };
  });

  for (const msg of postMsgs) await sendSystemMessage(roomId, msg).catch(console.error);
  return result;
}

// ─── Reset ─────────────────────────────────────────────────────────────────

export async function resetUnoGame(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const u = snap.data()?.unoState;
  if (!u) return;
  await initUnoGame(roomId, u.playerOrder);
}

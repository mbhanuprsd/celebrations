// src/games/uno/unoFirebaseService.js
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { buildDeck, shuffleArray, canPlayCard, nextIndex } from './unoConstants';
import { sendSystemMessage , safeUpdateDoc } from '../../firebase/services';

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
    playerIds.forEach(id => {
      if (d.length) hands[id].push(d.shift());
    });
  }
  return { hands, deck: d };
}

function drawCards(count, deck, discardPile) {
  let d = [...deck];
  let dp = [...discardPile];
  const drawn = [];
  for (let i = 0; i < count; i++) {
    const refilled = recheckDeck(d, dp);
    d = refilled.deck;
    dp = refilled.discardPile;
    if (d.length) drawn.push(d.shift());
  }
  return { drawn, deck: d, discardPile: dp };
}

// ─── Init ──────────────────────────────────────────────────────────────────

export async function initUnoGame(roomId, playerOrder) {
  let deck = shuffleArray(buildDeck());
  const { hands, deck: remaining } = dealCards(deck, playerOrder);

  // First card: must not be Wild or Wild+4
  let startIdx = remaining.findIndex(c => c.color !== 'wild');
  if (startIdx === -1) startIdx = 0;
  const topCard = remaining[startIdx];
  let restDeck = remaining.filter((_, i) => i !== startIdx);

  // Handle starting card effects
  let currentIndex = 0;
  let direction = 1;
  let pendingDraw = 0;
  let pendingDrawType = null;
  const count = playerOrder.length;

  if (topCard.type === 'reverse') {
    direction = -1;
    if (count === 2) {
      // Reverse in 2-player = skip; player 0 goes again — wait, actually skip = player 1 goes first... 
      // In 2-player, reverse acts as skip so player 0 keeps turn. Stay at 0.
      currentIndex = 0;
    } else {
      // Direction reversed, turn goes to last player
      currentIndex = count - 1;
    }
  } else if (topCard.type === 'skip') {
    // First player is skipped; start at index 1
    currentIndex = nextIndex(0, direction, count);
  } else if (topCard.type === 'draw2') {
    // First player must draw 2 — set pendingDraw, they draw on their turn
    pendingDraw = 2;
    pendingDrawType = 'draw2';
    currentIndex = 0;
  }

  const unoState = {
    deck: restDeck,
    discardPile: [topCard],
    topCard,
    activeColor: topCard.color,
    hands,
    playerOrder,
    currentIndex,
    direction,
    pendingDraw,
    pendingDrawType,
    rankings: [],
    winner: null,
    turnCount: 0,
    lastAction: null,
  };

  await safeUpdateDoc(doc(db, 'rooms', roomId), { status: 'playing', unoState });
  await sendSystemMessage(roomId, `🃏 UNO started! ${playerOrder.length} players. Good luck!`);
  if (topCard.type === 'reverse') await sendSystemMessage(roomId, `↺ First card is Reverse!`);
  if (topCard.type === 'skip')    await sendSystemMessage(roomId, `⊘ First card is Skip!`);
  if (topCard.type === 'draw2')   await sendSystemMessage(roomId, `✋ First card is +2!`);
}

// ─── Play Card ─────────────────────────────────────────────────────────────

export async function playUnoCard(roomId, userId, cardId, chosenColor = null) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const room = snap.data();
  const u = room.unoState;

  // ── Guards ──
  if (u.winner) return { error: 'Game over' };
  if (u.playerOrder[u.currentIndex] !== userId) return { error: 'Not your turn' };

  const hand = u.hands[userId] || [];
  const cardIdx = hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return { error: 'Card not in hand' };
  const card = hand[cardIdx];

  // ── Server-side playability check (includes pendingDraw) ──
  if (!canPlayCard(card, u.topCard, u.activeColor, u.pendingDraw, u.pendingDrawType)) {
    return { error: 'Cannot play that card' };
  }

  // Wild requires a color choice
  if ((card.type === 'wild' || card.type === 'wild4') && !chosenColor) {
    return { error: 'Choose a color first' };
  }

  const count = u.playerOrder.length;
  const newHand = hand.filter((_, i) => i !== cardIdx);
  const newDiscardPile = [...(u.discardPile || []), card];
  const newActiveColor = chosenColor || card.color;

  // ── Direction and skip logic ──
  let newDirection = u.direction;
  let skip = false;

  if (card.type === 'reverse') {
    newDirection = -u.direction;
    if (count === 2) skip = true; // 2-player: reverse = skip
  }
  if (card.type === 'skip') skip = true;

  // ── Pending draw: stack or start new chain ──
  let newPendingDraw = 0;
  let newPendingDrawType = null;

  if (card.type === 'draw2') {
    newPendingDraw = (u.pendingDraw || 0) + 2;
    newPendingDrawType = 'draw2';
  } else if (card.type === 'wild4') {
    newPendingDraw = (u.pendingDraw || 0) + 4;
    newPendingDrawType = 'wild4';
  }
  // Playing any other card clears any previous pending (shouldn't reach here with pending active)

  // ── Check if player finished ──
  const newHands = { ...u.hands, [userId]: newHand };
  let newRankings = [...(u.rankings || [])];
  const finished = newHand.length === 0;
  if (finished && !newRankings.includes(userId)) newRankings.push(userId);

  const remainingActive = u.playerOrder.filter(
    id => (id === userId ? newHand.length > 0 : (u.hands[id]?.length || 0) > 0) && !newRankings.includes(id)
  );
  const gameOver = remainingActive.length <= 1;

  // ── Advance turn ──
  let nextIdx = nextIndex(u.currentIndex, newDirection, count, skip);

  // For draw2/wild4, DO NOT force-draw here.
  // pendingDraw is persisted; the NEXT player will draw via drawUnoCard or stack.

  if (gameOver) {
    if (remainingActive.length === 1 && !newRankings.includes(remainingActive[0])) {
      newRankings.push(remainingActive[0]);
    }
  }

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

  if (gameOver) {
    updates['unoState.winner'] = newRankings[0];
    updates['status'] = 'finished';
  }

  await safeUpdateDoc(doc(db, 'rooms', roomId), updates);

  // ── System messages ──
  const pName = room.players?.[userId]?.name || 'Someone';
  if (card.type === 'wild4')   await sendSystemMessage(roomId, `🎨 ${pName} played Wild+4 → ${chosenColor}! Next player: draw ${newPendingDraw} or stack.`);
  else if (card.type === 'wild')    await sendSystemMessage(roomId, `🎨 ${pName} played Wild → ${chosenColor}!`);
  else if (card.type === 'draw2')   await sendSystemMessage(roomId, `✋ ${pName} played +2! Pending: ${newPendingDraw}`);
  else if (card.type === 'skip')    await sendSystemMessage(roomId, `⊘ ${pName} played Skip!`);
  else if (card.type === 'reverse') await sendSystemMessage(roomId, `↺ ${pName} reversed direction!`);

  if (newHand.length === 1) await sendSystemMessage(roomId, `⚠️ ${pName} has UNO!`);
  if (finished)             await sendSystemMessage(roomId, `🎉 ${pName} finished at #${newRankings.length}!`);
  if (gameOver)             await sendSystemMessage(roomId, `🏆 Game over! ${room.players?.[newRankings[0]]?.name} wins!`);

  return { ok: true };
}

// ─── Draw Card ─────────────────────────────────────────────────────────────

export async function drawUnoCard(roomId, userId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const room = snap.data();
  const u = room.unoState;

  if (u.winner) return { error: 'Game over' };
  if (u.playerOrder[u.currentIndex] !== userId) return { error: 'Not your turn' };

  const count = u.playerOrder.length;

  // If pendingDraw > 0: player must absorb all pending cards and lose their turn
  // If no pending: draw exactly 1 card; if it's playable the player may choose to play it,
  //   but in this implementation drawing always ends your turn (like Plato's Ocho).
  const drawCount = (u.pendingDraw || 0) > 0 ? u.pendingDraw : 1;
  const hadPending = (u.pendingDraw || 0) > 0;

  const { drawn, deck: newDeck, discardPile: newDiscard } = drawCards(drawCount, u.deck, u.discardPile);
  const newHand = [...(u.hands[userId] || []), ...drawn];

  // Drawing always passes the turn (no "draw then play" mechanic here, like Ocho)
  const nextIdx = nextIndex(u.currentIndex, u.direction, count);

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    'unoState.deck':            newDeck,
    'unoState.discardPile':     newDiscard,
    [`unoState.hands.${userId}`]: newHand,
    'unoState.currentIndex':    nextIdx,
    'unoState.pendingDraw':     0,
    'unoState.pendingDrawType': null,
    'unoState.turnCount':       (u.turnCount || 0) + 1,
    'unoState.lastAction':      { type: 'draw', uid: userId, count: drawCount },
  });

  const pName = room.players?.[userId]?.name || 'Someone';
  if (hadPending) {
    await sendSystemMessage(roomId, `📥 ${pName} drew ${drawCount} cards (penalty)!`);
  }

  return { ok: true, drew: drawCount };
}

// ─── Reset ─────────────────────────────────────────────────────────────────

export async function resetUnoGame(roomId) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const u = snap.data()?.unoState;
  if (!u) return;
  await initUnoGame(roomId, u.playerOrder);
}
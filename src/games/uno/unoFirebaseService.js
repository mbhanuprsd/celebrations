// src/games/uno/unoFirebaseService.js
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { buildDeck, shuffleArray, canPlayCard, nextIndex, PLAYABLE_COLORS } from './unoConstants';
import { sendSystemMessage } from '../../firebase/services';

const HAND_SIZE = 7;

// ─── Helpers ───────────────────────────────────────────────────────────────

function recheckDeck(deck, discardPile) {
  // When deck is empty, reshuffle all discard except the top card
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

// ─── Init ──────────────────────────────────────────────────────────────────

export async function initUnoGame(roomId, playerOrder) {
  let deck = shuffleArray(buildDeck());
  const { hands, deck: remaining } = dealCards(deck, playerOrder);

  // Pick first non-wild card as starter
  let startIdx = remaining.findIndex(c => c.color !== 'wild');
  if (startIdx === -1) startIdx = 0;
  const topCard = remaining[startIdx];
  const restDeck = remaining.filter((_, i) => i !== startIdx);

  const unoState = {
    deck: restDeck,
    discardPile: [topCard],
    topCard,
    activeColor: topCard.color,
    hands,
    playerOrder,
    currentIndex: 0,
    direction: 1,
    pendingDraw: 0,        // accumulated +2/+4 stacks
    rankings: [],
    winner: null,
    turnCount: 0,
    lastAction: null,
  };

  await updateDoc(doc(db, 'rooms', roomId), { status: 'playing', unoState });
  await sendSystemMessage(roomId, `🃏 UNO started! ${playerOrder.length} players. Good luck!`);
}

// ─── Play Card ─────────────────────────────────────────────────────────────

export async function playUnoCard(roomId, userId, cardId, chosenColor = null) {
  const snap = await getDoc(doc(db, 'rooms', roomId));
  const room = snap.data();
  const u = room.unoState;

  if (u.winner) return { error: 'Game over' };
  if (u.playerOrder[u.currentIndex] !== userId) return { error: 'Not your turn' };

  const hand = u.hands[userId] || [];
  const cardIdx = hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return { error: 'Card not in hand' };
  const card = hand[cardIdx];

  if (!canPlayCard(card, u.topCard, u.activeColor)) return { error: 'Cannot play that card' };

  // Wild requires chosen color
  if ((card.type === 'wild' || card.type === 'wild4') && !chosenColor) {
    return { error: 'Choose a color' };
  }

  const newHand = hand.filter((_, i) => i !== cardIdx);
  const newDiscardPile = [...u.discardPile, card];
  const newActiveColor = chosenColor || card.color;
  const count = u.playerOrder.length;

  let newDirection = u.direction;
  let newPendingDraw = u.pendingDraw;
  let skip = false;

  if (card.type === 'reverse') {
    newDirection = -u.direction;
    if (count === 2) skip = true; // reverse acts as skip in 2-player
  }
  if (card.type === 'skip') skip = true;
  if (card.type === 'draw2') newPendingDraw += 2;
  if (card.type === 'wild4') newPendingDraw += 4;

  const newHands = { ...u.hands, [userId]: newHand };

  // Check if this player finished
  let newRankings = [...u.rankings];
  const finished = newHand.length === 0;
  if (finished && !newRankings.includes(userId)) newRankings.push(userId);

  // Remaining active players (those with cards left)
  const remaining = u.playerOrder.filter(id => (id === userId ? newHand.length > 0 : (u.hands[id]?.length || 0) > 0) && !newRankings.includes(id));
  const gameOver = remaining.length <= 1;

  let nextIdx = nextIndex(u.currentIndex, newDirection, count, skip);

  // If next player has to draw (draw2 / wild4)
  let nextHands = { ...newHands };
  let finalDeck = [...u.deck];
  let finalDiscard = [...newDiscardPile];

  if (newPendingDraw > 0 && !gameOver) {
    const nextUid = u.playerOrder[nextIdx];
    const nextHand = [...(nextHands[nextUid] || [])];
    for (let i = 0; i < newPendingDraw; i++) {
      const refilled = recheckDeck(finalDeck, finalDiscard);
      finalDeck = refilled.deck;
      finalDiscard = refilled.discardPile;
      if (finalDeck.length) nextHand.push(finalDeck.shift());
    }
    nextHands[nextUid] = nextHand;
    // Skip that player's turn
    nextIdx = nextIndex(nextIdx, newDirection, count, true);
    newPendingDraw = 0;
  }

  if (gameOver) {
    // Add last remaining player to rankings
    if (remaining.length === 1 && !newRankings.includes(remaining[0])) {
      newRankings.push(remaining[0]);
    }
  }

  const updates = {
    'unoState.deck': finalDeck,
    'unoState.discardPile': finalDiscard,
    'unoState.topCard': card,
    'unoState.activeColor': newActiveColor,
    'unoState.hands': nextHands,
    'unoState.direction': newDirection,
    'unoState.pendingDraw': newPendingDraw,
    'unoState.currentIndex': nextIdx,
    'unoState.rankings': newRankings,
    'unoState.turnCount': u.turnCount + 1,
    'unoState.lastAction': { type: 'play', uid: userId, card, chosenColor },
  };

  if (gameOver) {
    updates['unoState.winner'] = newRankings[0];
    updates['status'] = 'finished';
  }

  await updateDoc(doc(db, 'rooms', roomId), updates);

  // System messages
  const playerName = room.players?.[userId]?.name || 'Someone';
  if (card.type === 'wild' || card.type === 'wild4') {
    await sendSystemMessage(roomId, `🎨 ${playerName} played ${card.type === 'wild4' ? 'Wild +4' : 'Wild'} → ${chosenColor}`);
  } else if (card.type === 'draw2') {
    await sendSystemMessage(roomId, `✋ ${playerName} played +2!`);
  } else if (card.type === 'skip') {
    await sendSystemMessage(roomId, `⊘ ${playerName} skipped next player!`);
  } else if (card.type === 'reverse') {
    await sendSystemMessage(roomId, `↺ ${playerName} reversed direction!`);
  }
  if (finished) {
    await sendSystemMessage(roomId, `🎉 ${playerName} finished at #${newRankings.length}!`);
  }
  if (newHand.length === 1) {
    await sendSystemMessage(roomId, `⚠️ ${playerName} has UNO!`);
  }
  if (gameOver) {
    await sendSystemMessage(roomId, `🏆 Game over! ${room.players?.[newRankings[0]]?.name} wins!`);
  }

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
  const drawCount = u.pendingDraw > 0 ? u.pendingDraw : 1;

  let { deck: newDeck, discardPile: newDiscard } = recheckDeck([...u.deck], [...u.discardPile]);
  const newHand = [...(u.hands[userId] || [])];

  for (let i = 0; i < drawCount; i++) {
    const refilled = recheckDeck(newDeck, newDiscard);
    newDeck = refilled.deck;
    newDiscard = refilled.discardPile;
    if (newDeck.length) newHand.push(newDeck.shift());
  }

  const nextIdx = nextIndex(u.currentIndex, u.direction, count);
  const playerName = room.players?.[userId]?.name || 'Someone';

  await updateDoc(doc(db, 'rooms', roomId), {
    'unoState.deck': newDeck,
    'unoState.discardPile': newDiscard,
    [`unoState.hands.${userId}`]: newHand,
    'unoState.currentIndex': nextIdx,
    'unoState.pendingDraw': 0,
    'unoState.turnCount': u.turnCount + 1,
    'unoState.lastAction': { type: 'draw', uid: userId, count: drawCount },
  });

  if (drawCount > 1) {
    await sendSystemMessage(roomId, `📥 ${playerName} drew ${drawCount} cards!`);
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

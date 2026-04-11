// src/games/uno/unoConstants.js

export const UNO_COLOR_META = {
  red:    { hex: '#DC2626', dark: '#991B1B', name: 'Red',    emoji: '🔴' },
  blue:   { hex: '#2563EB', dark: '#1E40AF', name: 'Blue',   emoji: '🔵' },
  green:  { hex: '#16A34A', dark: '#166534', name: 'Green',  emoji: '🟢' },
  yellow: { hex: '#CA8A04', dark: '#854D0E', name: 'Yellow', emoji: '🟡' },
};

export const PLAYABLE_COLORS = ['red', 'blue', 'green', 'yellow'];

/** Build a full 108-card UNO deck */
export function buildDeck() {
  const cards = [];
  let id = 0;
  for (const color of PLAYABLE_COLORS) {
    cards.push({ id: id++, color, type: 'number', value: 0 });
    for (let n = 1; n <= 9; n++) {
      cards.push({ id: id++, color, type: 'number', value: n });
      cards.push({ id: id++, color, type: 'number', value: n });
    }
    for (let i = 0; i < 2; i++) {
      cards.push({ id: id++, color, type: 'skip' });
      cards.push({ id: id++, color, type: 'reverse' });
      cards.push({ id: id++, color, type: 'draw2' });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: id++, color: 'wild', type: 'wild' });
    cards.push({ id: id++, color: 'wild', type: 'wild4' });
  }
  return cards;
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** True if card can be played on top of topCard with the given activeColor */
export function canPlayCard(card, topCard, activeColor) {
  if (card.type === 'wild' || card.type === 'wild4') return true;
  if (card.color === activeColor) return true;
  if (topCard.type === 'number' && card.type === 'number' && card.value === topCard.value) return true;
  if (topCard.type !== 'number' && card.type === topCard.type) return true;
  return false;
}

export function getCardLabel(card) {
  if (!card) return '';
  if (card.type === 'number') return String(card.value);
  if (card.type === 'skip') return '⊘';
  if (card.type === 'reverse') return '↺';
  if (card.type === 'draw2') return '+2';
  if (card.type === 'wild') return '★';
  if (card.type === 'wild4') return '+4';
  return '?';
}

/** Advance turn index considering direction and optional skip */
export function nextIndex(current, direction, count, skip = false) {
  let next = (current + direction + count) % count;
  if (skip) next = (next + direction + count) % count;
  return next;
}

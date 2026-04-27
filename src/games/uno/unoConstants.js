// src/games/uno/unoConstants.js
// UNO Game Implementation (Ocho/Plato style)
//
// HOUSE RULES IN USE:
// - Draw stacking: Players can stack +2 on +2 or +4 on +4 to extend the penalty chain
// - Only matching draw types stack (cannot mix +2 and +4)
// - Final player in chain must draw the accumulated total
//
// DIFFERENCES FROM STANDARD UNO:
// - Standard UNO doesn't allow stacking at all; all penalties are immediate
// - This implementation uses the "stacking house rule" variant for more interactive gameplay

export const UNO_COLOR_META = {
  red:    { hex: '#E53935', dark: '#B71C1C', name: 'Red',    emoji: '🔴' },
  blue:   { hex: '#1E88E5', dark: '#0D47A1', name: 'Blue',   emoji: '🔵' },
  green:  { hex: '#43A047', dark: '#1B5E20', name: 'Green',  emoji: '🟢' },
  yellow: { hex: '#FDD835', dark: '#F57F17', name: 'Yellow', emoji: '🟡' },
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
  return cards; // 108 total
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * canPlayCard — UNO rules with draw-stacking house rule
 *
 * STACKING MECHANIC (House Rule):
 * When pendingDraw > 0, a draw-card chain is active. Players can ONLY play:
 * - If pendingDrawType === 'draw2': another Draw2 (accumulates to pendingDraw + 2)
 * - If pendingDrawType === 'wild4': another Wild+4 (accumulates to pendingDraw + 4)
 * - Cannot mix types; +2 chain blocks +4 and vice versa
 * - Other plays are blocked; player MUST draw via draw button
 *
 * STANDARD MODE (No pending):
 * - Wild/Wild4: Always playable
 * - Color match: Play card same color as active color
 * - Number match: Play card with same number value
 * - Action match: Play matching action card type (Skip, Reverse, Draw2)
 */
export function canPlayCard(card, topCard, activeColor, pendingDraw = 0, pendingDrawType = null) {
  if (pendingDraw > 0) {
    // Only matching draw-type can stack
    if (pendingDrawType === 'draw2') return card.type === 'draw2';
    if (pendingDrawType === 'wild4') return card.type === 'wild4';
    return false;
  }

  if (card.type === 'wild' || card.type === 'wild4') return true;
  if (card.color === activeColor) return true;
  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
  if (card.type !== 'number' && card.type === topCard.type) return true;
  return false;
}

export function getCardLabel(card) {
  if (!card) return '';
  if (card.type === 'number') return String(card.value);
  if (card.type === 'skip')    return '⊘';
  if (card.type === 'reverse') return '↺';
  if (card.type === 'draw2')   return '+2';
  if (card.type === 'wild')    return '★';
  if (card.type === 'wild4')   return '+4';
  return '?';
}

export function nextIndex(current, direction, count, skip = false) {
  let next = ((current + direction) % count + count) % count;
  if (skip) next = ((next + direction) % count + count) % count;
  return next;
}

// src/games/snakeladder/snakeLadderConstants.js

// ─── Board Layout ──────────────────────────────────────────────────────────
export const BOARD_SIZE = 100;

// Ladders: { from: to }  (bottom → top)
export const LADDERS = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
};

// Snakes: { head: tail }  (head → tail, going DOWN)
export const SNAKES = {
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
};

// ─── 12-Player Colors ──────────────────────────────────────────────────────
export const PLAYER_COLORS = [
  { id: 'red',    hex: '#EF4444', light: '#FEE2E2', name: 'Red',    emoji: '🔴' },
  { id: 'blue',   hex: '#3B82F6', light: '#DBEAFE', name: 'Blue',   emoji: '🔵' },
  { id: 'green',  hex: '#22C55E', light: '#DCFCE7', name: 'Green',  emoji: '🟢' },
  { id: 'yellow', hex: '#EAB308', light: '#FEF9C3', name: 'Yellow', emoji: '🟡' },
  { id: 'purple', hex: '#A855F7', light: '#F3E8FF', name: 'Purple', emoji: '🟣' },
  { id: 'orange', hex: '#F97316', light: '#FFEDD5', name: 'Orange', emoji: '🟠' },
  { id: 'pink',   hex: '#EC4899', light: '#FCE7F3', name: 'Pink',   emoji: '🩷' },
  { id: 'cyan',   hex: '#06B6D4', light: '#CFFAFE', name: 'Cyan',   emoji: '🩵' },
  { id: 'lime',   hex: '#84CC16', light: '#ECFCCB', name: 'Lime',   emoji: '🍏' },
  { id: 'teal',   hex: '#14B8A6', light: '#CCFBF1', name: 'Teal',   emoji: '🌊' },
  { id: 'rose',   hex: '#FB7185', light: '#FFE4E6', name: 'Rose',   emoji: '🌹' },
  { id: 'indigo', hex: '#6366F1', light: '#E0E7FF', name: 'Indigo', emoji: '💜' },
];

export const PLAYER_COLOR_MAP = Object.fromEntries(PLAYER_COLORS.map(c => [c.id, c]));

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Convert board cell (1-100) to [col, row] in a 10x10 grid (0-indexed from bottom-left) */
export function cellToGrid(cell) {
  const idx = cell - 1; // 0-indexed
  const row = Math.floor(idx / 10); // 0 = bottom row
  const col = row % 2 === 0 ? idx % 10 : 9 - (idx % 10); // snake pattern
  return { col, row };
}

/** Assign color ids to player array */
export function assignPlayerColors(playerIds) {
  const map = {};
  playerIds.forEach((id, i) => {
    map[id] = PLAYER_COLORS[i % PLAYER_COLORS.length].id;
  });
  return map;
}

/** Apply snake/ladder effect, return { newPos, type, from, to } */
export function applyEffect(pos) {
  if (LADDERS[pos]) return { newPos: LADDERS[pos], type: 'ladder', from: pos, to: LADDERS[pos] };
  if (SNAKES[pos])  return { newPos: SNAKES[pos],  type: 'snake',  from: pos, to: SNAKES[pos] };
  return { newPos: pos, type: null };
}

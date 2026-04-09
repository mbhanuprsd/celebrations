// src/games/ludo/ludoConstants.js
// Complete Ludo board layout: 15x15 grid, 600x600px

export const CELL_SIZE = 40;
export const BOARD_SIZE = 15 * CELL_SIZE; // 600

// Helper: grid cell → pixel center
export const cell = (row, col) => ({
  x: col * CELL_SIZE + CELL_SIZE / 2,
  y: row * CELL_SIZE + CELL_SIZE / 2,
});

// ─── Colors ────────────────────────────────────────────────────────────────
export const LUDO_COLORS = {
  red:    { hex: '#EF233C', light: '#FFEEF0', dark: '#B71C1C', name: 'Red' },
  blue:   { hex: '#4361EE', light: '#EEF1FF', dark: '#1A237E', name: 'Blue' },
  green:  { hex: '#06D6A0', light: '#E8FDF7', dark: '#00695C', name: 'Green' },
  yellow: { hex: '#FFD166', light: '#FFFBE6', dark: '#E65100', name: 'Yellow' },
};

export const COLOR_ORDER = ['red', 'blue', 'green', 'yellow'];

// ─── Main Path: 52 cells going clockwise (index 0 = Red start) ────────────
// Segment pattern: 5 arm cells + 6 column cells + 2 corner cells = 13 per quadrant
export const MAIN_PATH = [
  // Q0 (Red, indices 0-12): left arm right + top-left col up + top border
  cell(6,1),cell(6,2),cell(6,3),cell(6,4),cell(6,5),
  cell(5,6),cell(4,6),cell(3,6),cell(2,6),cell(1,6),cell(0,6),
  cell(0,7),cell(0,8),

  // Q1 (Blue, indices 13-25): top-right col down + right arm right + right border
  cell(1,8),cell(2,8),cell(3,8),cell(4,8),cell(5,8),
  cell(6,9),cell(6,10),cell(6,11),cell(6,12),cell(6,13),cell(6,14),
  cell(7,14),cell(8,14),

  // Q2 (Green, indices 26-38): right arm left + bottom-right col down + bottom border
  cell(8,13),cell(8,12),cell(8,11),cell(8,10),cell(8,9),
  cell(9,8),cell(10,8),cell(11,8),cell(12,8),cell(13,8),cell(14,8),
  cell(14,7),cell(14,6),

  // Q3 (Yellow, indices 39-51): bottom-left col up + left arm left + left border
  cell(13,6),cell(12,6),cell(11,6),cell(10,6),cell(9,6),
  cell(8,5),cell(8,4),cell(8,3),cell(8,2),cell(8,1),cell(8,0),
  cell(7,0),cell(6,0),
];

// ─── Home Stretches: 5 cells per color, leading to center ──────────────────
export const HOME_STRETCH = {
  red:    [cell(7,1),cell(7,2),cell(7,3),cell(7,4),cell(7,5)],
  blue:   [cell(1,7),cell(2,7),cell(3,7),cell(4,7),cell(5,7)],
  green:  [cell(7,13),cell(7,12),cell(7,11),cell(7,10),cell(7,9)],
  yellow: [cell(13,7),cell(12,7),cell(11,7),cell(10,7),cell(9,7)],
};

// ─── Center (WIN) ──────────────────────────────────────────────────────────
export const CENTER_COORD = cell(7, 7);

// ─── Home Base Circles (4 per color, resting spots) ───────────────────────
export const HOME_BASE_COORDS = {
  red:    [cell(1,1),cell(1,3),cell(3,1),cell(3,3)],
  blue:   [cell(1,11),cell(1,13),cell(3,11),cell(3,13)],
  green:  [cell(11,11),cell(11,13),cell(13,11),cell(13,13)],
  yellow: [cell(11,1),cell(11,3),cell(13,1),cell(13,3)],
};

// ─── Player entry points on main path (index into MAIN_PATH) ──────────────
export const COLOR_START_INDEX = { red: 0, blue: 13, green: 26, yellow: 39 };

// ─── Safe cells (main path indices, cannot be captured) ───────────────────
// Start cells + star cells (every ~8 steps)
export const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// ─── Board cell grid info (for rendering colored squares) ─────────────────
// Home quadrant bounding boxes [row, col, rows, cols]
export const HOME_QUADS = {
  red:    { row: 0, col: 0, size: 6, color: 'red' },
  blue:   { row: 0, col: 9, size: 6, color: 'blue' },
  green:  { row: 9, col: 9, size: 6, color: 'green' },
  yellow: { row: 9, col: 0, size: 6, color: 'yellow' },
};

// Home-stretch cell row/col lists (for colored rendering)
export const HOME_STRETCH_CELLS = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5]],
  blue:   [[1,7],[2,7],[3,7],[4,7],[5,7]],
  green:  [[7,13],[7,12],[7,11],[7,10],[7,9]],
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7]],
};

// Center triangle cells [row, col] grouped per color direction
export const CENTER_TRIANGLES = {
  red:    [[7,6],[6,6],[8,6]],
  blue:   [[6,7],[6,6],[6,8]],
  green:  [[7,8],[6,8],[8,8]],
  yellow: [[8,7],[8,6],[8,8]],
};

// ─── Piece position helpers ────────────────────────────────────────────────
// step: -1 = home base, 0-56 = on board, 57 = WIN
export const TOTAL_STEPS = 57; // 52 main + 5 home stretch + land on center

export function getPieceCoord(color, step, pieceIndex) {
  if (step === -1) return HOME_BASE_COORDS[color][pieceIndex];
  if (step >= 57) return CENTER_COORD;
  if (step >= 52) return HOME_STRETCH[color][step - 52];
  const mainIdx = (COLOR_START_INDEX[color] + step) % 52;
  return MAIN_PATH[mainIdx];
}

export function getMainPathIndex(color, step) {
  if (step < 0 || step >= 52) return -1;
  return (COLOR_START_INDEX[color] + step) % 52;
}

// Is a given main path index a home-stretch entry for this color?
// A piece enters home stretch when it has completed 51 main path steps
// i.e., step 51 is the last main path step, step 52+ is home stretch

export function canCapture(attackerColor, victimColor, mainPathIndex) {
  if (attackerColor === victimColor) return false;
  if (SAFE_CELLS.has(mainPathIndex)) return false;
  return true;
}

// Color assigned per join order (max 4 players)
export function assignColors(playerIds) {
  const map = {};
  playerIds.forEach((id, i) => { map[id] = COLOR_ORDER[i]; });
  return map; // { userId: 'red' | 'blue' | 'green' | 'yellow' }
}

import {
  TOTAL_STEPS,
  canCapture,
  getMovablePieceIds,
  getNextLudoColor,
  getPieceDestination,
} from './ludoConstants';

describe('Ludo movement rules', () => {
  test('requires a six to move a piece out of base', () => {
    expect(getPieceDestination(-1, 5)).toBeNull();
    expect(getPieceDestination(-1, 6)).toBe(0);
    expect(getMovablePieceIds([{ id: 0, step: -1 }], 5)).toEqual([]);
    expect(getMovablePieceIds([{ id: 0, step: -1 }], 6)).toEqual([0]);
  });

  test('allows exact moves to the center and rejects overshoots', () => {
    expect(getPieceDestination(TOTAL_STEPS - 1, 1)).toBe(TOTAL_STEPS);
    expect(getPieceDestination(TOTAL_STEPS - 2, 1)).toBe(TOTAL_STEPS - 1);
    expect(getPieceDestination(TOTAL_STEPS - 1, 2)).toBeNull();
    expect(getPieceDestination(TOTAL_STEPS, 1)).toBeNull();
  });

  test('only lists unfinished pieces with legal destinations', () => {
    const pieces = [
      { id: 0, step: -1 },
      { id: 1, step: TOTAL_STEPS - 1 },
      { id: 2, step: TOTAL_STEPS },
      { id: 3, step: 0 },
    ];

    expect(getMovablePieceIds(pieces, 1)).toEqual([1, 3]);
    expect(getMovablePieceIds(pieces, 2)).toEqual([3]);
    expect(getMovablePieceIds(pieces, 6)).toEqual([0, 3]);
  });

  test('rejects invalid dice values and piece steps', () => {
    [0, 7, -1, 1.5, null].forEach(value => {
      expect(getPieceDestination(0, value)).toBeNull();
      expect(getMovablePieceIds([{ id: 0, step: 0 }], value)).toEqual([]);
    });
    [-2, 58, 0.5, null].forEach(step => {
      expect(getPieceDestination(step, 6)).toBeNull();
    });
    expect(getMovablePieceIds(null, 6)).toEqual([]);
  });

  test('advances turns through active colors only', () => {
    const activeColors = ['red', 'green', 'yellow'];
    expect(getNextLudoColor('red', activeColors)).toBe('green');
    expect(getNextLudoColor('yellow', activeColors)).toBe('red');
    expect(getNextLudoColor('blue', activeColors)).toBeNull();
    expect(getNextLudoColor('red', [])).toBeNull();
    expect(getNextLudoColor('red', undefined)).toBeNull();
  });

  test('prevents captures on safe cells and between pieces of the same color', () => {
    expect(canCapture('red', 'blue', 1)).toBe(true);
    expect(canCapture('red', 'blue', 0)).toBe(false);
    expect(canCapture('red', 'red', 1)).toBe(false);
  });
});

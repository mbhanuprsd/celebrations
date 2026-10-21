import { calculateBoggleScores, createBoggleBoard, extendBogglePath, getWordScore, isWordOnBoard, normalizeBoggleRoundSeconds, parseBoggleDictionary } from './boggleConstants';

describe('Boggle helpers', () => {
  test('normalizes round duration to 30-second steps between 30 and 120 seconds', () => {
    expect([30, 60, 90, 120].map(normalizeBoggleRoundSeconds)).toEqual([30, 60, 90, 120]);
    expect(normalizeBoggleRoundSeconds(20)).toBe(30);
    expect(normalizeBoggleRoundSeconds(75)).toBe(90);
    expect(normalizeBoggleRoundSeconds(150)).toBe(120);
    expect(normalizeBoggleRoundSeconds('invalid')).toBe(120);
  });

  test('creates a 4x4 board containing alphabetic tiles only', () => {
    const board = createBoggleBoard(() => 0);
    expect(board).toHaveLength(16);
    expect(board.every(letter => /^[a-z]$/.test(letter))).toBe(true);
  });

  test('finds words across adjacent and diagonal cells without reusing tiles', () => {
    const board = [
      'c', 'a', 't', 'x',
      'x', 'r', 'x', 'x',
      'x', 'x', 'x', 'x',
      'x', 'x', 'x', 'x',
    ];
    expect(isWordOnBoard('cat', board)).toBe(true);
    expect(isWordOnBoard('car', board)).toBe(true);
    expect(isWordOnBoard('cr', board)).toBe(true);
    expect(isWordOnBoard('caa', board)).toBe(false);
    expect(isWordOnBoard('ca1', board)).toBe(false);
  });

  test('extends a drag path only to neighboring unused cells and supports undo', () => {
    let path = extendBogglePath([], 0);
    path = extendBogglePath(path, 1);
    path = extendBogglePath(path, 5);
    expect(path).toEqual([0, 1, 5]);
    expect(extendBogglePath(path, 0)).toBe(path);
    expect(extendBogglePath(path, 1)).toEqual([0, 1]);
    expect(extendBogglePath(path, 15)).toBe(path);
    expect(extendBogglePath(path, 5)).toBe(path);
  });

  test('scores unique words for two points and shared words for one point per finder', () => {
    expect(getWordScore(1)).toBe(2);
    expect(getWordScore(2)).toBe(1);
    expect(getWordScore(3)).toBe(1);

    expect(calculateBoggleScores(['alice', 'bob', 'cara'], {
      unique: { alice: true },
      shared: { alice: true, bob: true },
      threeWay: { alice: true, bob: true, cara: true },
    })).toEqual({ alice: 4, bob: 2, cara: 1 });
  });

  test('keeps only alphabet-only dictionary words', () => {
    const words = parseBoggleDictionary("cat\r\n10-point\ncan't\nDOG\nab\n");
    expect([...words]).toEqual(['cat', 'dog']);
  });
});

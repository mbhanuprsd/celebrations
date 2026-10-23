import { calculateBoggleScores, createBoggleBoard, extendBogglePath, findLongestBoggleWords, getBoggleCellAtPoint, getBogglePathSegment, getWordScore, isWordOnBoard, normalizeBoggleRoundSeconds, parseBoggleDictionary } from './boggleConstants';

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

  test('finds every longest dictionary word traceable on the board', () => {
    const board = [
      'c', 'a', 't', 'x',
      'a', 'r', 'e', 'x',
      't', 'e', 'n', 'x',
      'x', 'x', 'x', 'x',
    ];
    const dictionary = new Set(['cat', 'care', 'cater', 'crate', 'ten', 'caterx']);

    expect(findLongestBoggleWords(board, dictionary)).toEqual(['cater', 'crate']);
    expect(findLongestBoggleWords(board, new Set(['cat', 'car', 'ten']))).toEqual(['car', 'cat', 'ten']);
    expect(findLongestBoggleWords(board, new Set(['cat']), 4)).toEqual([]);
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

  test('fills skipped cells when a swipe jumps over several tiles', () => {
    const segment = getBogglePathSegment(0, 3);
    expect(segment).toEqual([1, 2, 3]);
    const path = [0, ...segment];
    expect(path.slice(1).every((index, position) => {
      const previous = path[position];
      return Math.abs(Math.floor(index / 4) - Math.floor(previous / 4)) <= 1 &&
        Math.abs(index % 4 - previous % 4) <= 1;
    })).toBe(true);
  });

  test('traces diagonal swipe segments through adjacent cells', () => {
    expect(getBogglePathSegment(0, 10)).toEqual([5, 10]);
    expect(getBogglePathSegment(1, 12)).toEqual([5, 8, 12]);
    expect(getBogglePathSegment(6, 6)).toEqual([]);

    for (let start = 0; start < 16; start++) {
      for (let end = 0; end < 16; end++) {
        const path = [start, ...getBogglePathSegment(start, end)];
        expect(path[path.length - 1]).toBe(end);
        expect(path.slice(1).every((index, position) => {
          const previous = path[position];
          return Math.abs(Math.floor(index / 4) - Math.floor(previous / 4)) <= 1 &&
            Math.abs(index % 4 - previous % 4) <= 1;
        })).toBe(true);
      }
    }
  });

  test('maps positions in grid gaps to their nearest tile', () => {
    const centers = [
      { index: 0, x: 10, y: 10 },
      { index: 1, x: 30, y: 10 },
      { index: 2, x: 10, y: 30 },
      { index: 3, x: 30, y: 30 },
    ];
    expect(getBoggleCellAtPoint(centers, 20, 10)).toBe(0);
    expect(getBoggleCellAtPoint(centers, 29, 29)).toBe(3);
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

import { calculateBoggleScores, createBoggleBoard, extendBogglePath, findBoggleWordPath, findBoggleWords, findLongestBoggleWords, getBoggleCellAtPoint, getBoggleCellsAlongSegment, getBogglePathSegment, getNextBoggleBotActionAt, getWordScore, isWordOnBoard, normalizeBoggleRoundSeconds, parseBoggleDictionary } from './boggleConstants';

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

  test('schedules bot words at the next 10-second boundary before round end', () => {
    expect(getNextBoggleBotActionAt(1000, 31_000, 1000)).toBe(11_000);
    expect(getNextBoggleBotActionAt(1000, 31_000, 11_000)).toBe(21_000);
    expect(getNextBoggleBotActionAt(1000, 31_000, 29_000)).toBeNull();
    expect(getNextBoggleBotActionAt(1000, 31_000, 1000, 0)).toBeNull();
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

  test('returns a valid tile path for the word currently being scored', () => {
    const board = [
      'c', 'a', 't', 'x',
      'x', 'r', 'x', 'x',
      'x', 'x', 'x', 'x',
      'x', 'x', 'x', 'x',
    ];
    expect(findBoggleWordPath('cat', board)).toEqual([0, 1, 2]);
    expect(findBoggleWordPath('car', board)).toEqual([0, 1, 5]);
    expect(findBoggleWordPath('caa', board)).toEqual([]);
    expect(findBoggleWordPath('ca1', board)).toEqual([]);
  });

  test('finds every longest dictionary word traceable on the board', () => {
    const board = [
      'c', 'a', 't', 'x',
      'a', 'r', 'e', 'x',
      't', 'e', 'n', 'x',
      'x', 'x', 'x', 'x',
    ];
    const dictionary = new Set(['cat', 'care', 'cater', 'crate', 'ten', 'caterx']);

    expect(findBoggleWords(board, dictionary)).toEqual(['care', 'cat', 'cater', 'crate', 'ten']);
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
      { index: 0, x: 10, y: 10, width: 20, height: 20 },
      { index: 1, x: 30, y: 10, width: 20, height: 20 },
      { index: 2, x: 10, y: 30, width: 20, height: 20 },
      { index: 3, x: 30, y: 30, width: 20, height: 20 },
    ];
    expect(getBoggleCellAtPoint(centers, 20, 10)).toBeNull();
    expect(getBoggleCellAtPoint(centers, 29, 29)).toBe(3);
    expect(getBoggleCellAtPoint(centers, 15, 10)).toBe(0);
  });

  test('detects every tile along diagonal and crossing pointer strokes', () => {
    const centers = Array.from({ length: 16 }, (_, index) => ({
      index,
      x: 10 + (index % 4) * 20,
      y: 10 + Math.floor(index / 4) * 20,
      width: 20,
      height: 20,
    }));
    const bounds = { left: 0, top: 0, right: 80, bottom: 80 };

    expect(getBoggleCellsAlongSegment(centers, { x: 10, y: 10 }, { x: 70, y: 70 }, bounds))
      .toEqual([5, 10, 15]);
    expect(getBoggleCellsAlongSegment(centers, { x: 70, y: 10 }, { x: 10, y: 70 }, bounds))
      .toEqual([6, 9, 12]);
    expect(getBoggleCellsAlongSegment(centers, { x: 10, y: 10 }, { x: 70, y: 10 }, bounds))
      .toEqual([1, 2, 3]);
    expect(getBoggleCellsAlongSegment(centers, { x: 10, y: 10 }, { x: 30, y: 30 }, bounds))
      .toEqual([5]);
    expect(getBoggleCellsAlongSegment(centers, { x: 70, y: 10 }, { x: 50, y: 30 }, bounds))
      .toEqual([6]);
    expect(getBoggleCellsAlongSegment(centers, { x: 10, y: 10 }, { x: 33, y: 27 }, bounds))
      .toEqual([5]);
  });

  test('keeps a criss-cross gesture continuous across diagonal direction changes', () => {
    const centers = Array.from({ length: 16 }, (_, index) => ({
      index,
      x: 10 + (index % 4) * 20,
      y: 10 + Math.floor(index / 4) * 20,
      width: 20,
      height: 20,
    }));
    const bounds = { left: 0, top: 0, right: 80, bottom: 80 };
    const points = [0, 5, 2, 7, 11, 10, 14].map(index => centers[index]);
    const selected = [0];

    for (let index = 1; index < points.length; index++) {
      getBoggleCellsAlongSegment(centers, points[index - 1], points[index], bounds)
        .forEach(cell => {
          const nextPath = extendBogglePath(selected, cell);
          if (nextPath !== selected) {
            selected.splice(0, selected.length, ...nextPath);
          }
        });
    }

    expect(selected).toEqual([0, 5, 2, 7, 11, 10, 14]);
  });

  test('scores longer words more while rewarding unique words', () => {
    expect([4, 5, 6, 7, 8].map(length => getWordScore(2, length)))
      .toEqual([1, 2, 3, 5, 11]);
    expect([4, 5, 6].map(length => getWordScore(1, length)))
      .toEqual([2, 4, 6]);
    expect(getWordScore(0, 6)).toBe(0);

    expect(calculateBoggleScores(['alice', 'bob', 'cara'], {
      cats: { alice: true },
      tiger: { alice: true, bob: true },
      elephant: { alice: true, bob: true, cara: true },
    })).toEqual({ alice: 15, bob: 13, cara: 11 });
  });

  test('keeps only alphabet-only dictionary words', () => {
    const words = parseBoggleDictionary("cat\r\n10-point\ncan't\nDOG\nab\n");
    expect([...words]).toEqual(['cat', 'dog']);
  });
});

export const BOGGLE_ROUND_SECONDS = 120;
export const BOGGLE_MIN_ROUND_SECONDS = 30;
export const BOGGLE_ROUND_STEP_SECONDS = 30;
export const BOGGLE_BOARD_SIZE = 4;

export function normalizeBoggleRoundSeconds(seconds) {
  const parsedSeconds = Number(seconds);
  if (!Number.isFinite(parsedSeconds)) return BOGGLE_ROUND_SECONDS;
  const steppedSeconds = Math.round(parsedSeconds / BOGGLE_ROUND_STEP_SECONDS) * BOGGLE_ROUND_STEP_SECONDS;
  return Math.min(BOGGLE_ROUND_SECONDS, Math.max(BOGGLE_MIN_ROUND_SECONDS, steppedSeconds));
}

export function parseBoggleDictionary(text) {
  const words = new Set();
  text.split(/\r?\n/).forEach(line => {
    const word = line.trim().toLowerCase();
    if (/^[a-z]{3,16}$/.test(word)) words.add(word);
  });
  if (words.size === 0) throw new Error('The dictionary contains no usable alphabet-only words.');
  return words;
}

const LETTER_POOL = 'eeeeeeeeeeeeaaaaaaaaaiiiiiiiiioooooooonnnnnnrrrrrrttttttllllssssuuuuddddgggbbbccmmppffhhvvwwyykjxqz';

export function createBoggleBoard(random = Math.random) {
  return Array.from({ length: BOGGLE_BOARD_SIZE * BOGGLE_BOARD_SIZE }, () =>
    LETTER_POOL[Math.floor(random() * LETTER_POOL.length)]
  );
}

export function getWordScore(playerCount, wordLength = 4) {
  if (playerCount <= 0) return 0;
  const lengthScore = wordLength >= 8 ? 11
    : wordLength === 7 ? 5
      : wordLength === 6 ? 3
        : wordLength === 5 ? 2
          : wordLength >= 3 ? 1 : 0;
  return lengthScore * (playerCount === 1 ? 2 : 1);
}

export function getNextBoggleBotActionAt(startedAt, endsAt, now, intervalMs = 10_000) {
  if (![startedAt, endsAt, now, intervalMs].every(Number.isFinite) || intervalMs <= 0) return null;
  const elapsed = Math.max(0, now - startedAt);
  const nextAt = startedAt + (Math.floor(elapsed / intervalMs) + 1) * intervalMs;
  return nextAt < endsAt ? nextAt : null;
}

export function calculateBoggleScores(playerOrder, submissions) {
  const scores = Object.fromEntries(playerOrder.map(uid => [uid, 0]));
  Object.entries(submissions || {}).forEach(([word, foundBy]) => {
    const players = playerOrder.filter(uid => foundBy?.[uid]);
    const points = getWordScore(players.length, word.length);
    players.forEach(uid => {
      scores[uid] += points;
    });
  });
  return scores;
}

export function extendBogglePath(path, nextIndex) {
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= 16) return path;
  if (path.length === 0) return [nextIndex];
  if (path[path.length - 1] === nextIndex) return path;
  if (path.length > 1 && path[path.length - 2] === nextIndex) return path.slice(0, -1);
  if (path.includes(nextIndex)) return path;

  const lastIndex = path[path.length - 1];
  const rowDistance = Math.abs(Math.floor(lastIndex / BOGGLE_BOARD_SIZE) - Math.floor(nextIndex / BOGGLE_BOARD_SIZE));
  const columnDistance = Math.abs((lastIndex % BOGGLE_BOARD_SIZE) - (nextIndex % BOGGLE_BOARD_SIZE));
  if (rowDistance > 1 || columnDistance > 1) return path;
  return [...path, nextIndex];
}

export function getBogglePathSegment(startIndex, endIndex) {
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) ||
      startIndex < 0 || startIndex >= 16 || endIndex < 0 || endIndex >= 16 ||
      startIndex === endIndex) return [];

  const startRow = Math.floor(startIndex / BOGGLE_BOARD_SIZE);
  const startColumn = startIndex % BOGGLE_BOARD_SIZE;
  const endRow = Math.floor(endIndex / BOGGLE_BOARD_SIZE);
  const endColumn = endIndex % BOGGLE_BOARD_SIZE;
  const columnDistance = Math.abs(endColumn - startColumn);
  const rowDistance = -Math.abs(endRow - startRow);
  const columnStep = startColumn < endColumn ? 1 : -1;
  const rowStep = startRow < endRow ? 1 : -1;
  let error = columnDistance + rowDistance;
  let row = startRow;
  let column = startColumn;
  const segment = [];

  while (row !== endRow || column !== endColumn) {
    const doubledError = 2 * error;
    if (doubledError >= rowDistance) {
      error += rowDistance;
      column += columnStep;
    }
    if (doubledError <= columnDistance) {
      error += columnDistance;
      row += rowStep;
    }
    segment.push(row * BOGGLE_BOARD_SIZE + column);
  }

  return segment;
}

export function getBoggleCellAtPoint(cellCenters, x, y) {
  let nearestIndex = null;
  let nearestDistance = Infinity;

  cellCenters.forEach(({ index, x: centerX, y: centerY, width, height }) => {
    const horizontalDistance = Math.abs(centerX - x);
    const verticalDistance = Math.abs(centerY - y);
    if (!width || !height || horizontalDistance > width / 4 || verticalDistance > height / 4) return;

    const distance = horizontalDistance ** 2 + verticalDistance ** 2;
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  });

  return nearestIndex;
}

export function getBoggleCellsAlongSegment(cellCenters, start, end, bounds) {
  if (!cellCenters.length || !bounds) return [];
  const isInsideBoard = point => point.x >= bounds.left && point.x <= bounds.right &&
    point.y >= bounds.top && point.y <= bounds.bottom;
  if (!isInsideBoard(start) || !isInsideBoard(end)) return [];

  const minimumSize = cellCenters.reduce((minimum, center) => {
    if (!(center.width > 0) || !(center.height > 0)) return minimum;
    return Math.min(minimum, center.width, center.height);
  }, Infinity);
  if (!Number.isFinite(minimumSize)) return [];

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  const steps = Math.max(1, Math.ceil(distance / (minimumSize / 8)));
  const crossedCells = [];
  let previousCell = getBoggleCellAtPoint(cellCenters, start.x, start.y);

  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    const x = start.x + deltaX * progress;
    const y = start.y + deltaY * progress;
    const nearestIndex = getBoggleCellAtPoint(cellCenters, x, y);

    if (nearestIndex != null && nearestIndex !== previousCell) {
      crossedCells.push(nearestIndex);
      previousCell = nearestIndex;
    }
  }

  return crossedCells;
}

export function findBoggleWords(board, dictionary, minWordLength = 3) {
  if (!Array.isArray(board) || board.length !== BOGGLE_BOARD_SIZE ** 2 ||
      !(dictionary instanceof Set) || dictionary.size === 0) return [];

  const prefixes = new Set();
  dictionary.forEach(word => {
    if (!/^[a-z]+$/.test(word) || word.length < minWordLength || word.length > board.length) return;
    for (let length = 1; length <= word.length; length++) {
      prefixes.add(word.slice(0, length));
    }
  });

  const foundWords = new Set();

  const search = (index, usedCells, currentWord) => {
    const word = currentWord + board[index];
    if (!prefixes.has(word)) return;

    if (dictionary.has(word) && word.length >= minWordLength) {
      foundWords.add(word);
    }

    if (word.length === board.length) return;
    const row = Math.floor(index / BOGGLE_BOARD_SIZE);
    const column = index % BOGGLE_BOARD_SIZE;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (nextRow < 0 || nextRow >= BOGGLE_BOARD_SIZE ||
            nextColumn < 0 || nextColumn >= BOGGLE_BOARD_SIZE) continue;
        const nextIndex = nextRow * BOGGLE_BOARD_SIZE + nextColumn;
        const nextBit = 1 << nextIndex;
        if ((usedCells & nextBit) === 0) {
          search(nextIndex, usedCells | nextBit, word);
        }
      }
    }
  };

  board.forEach((_, index) => search(index, 1 << index, ''));
  return [...foundWords].sort((a, b) => a.localeCompare(b));
}

export function findLongestBoggleWords(board, dictionary, minWordLength = 3) {
  const words = findBoggleWords(board, dictionary, minWordLength);
  if (words.length === 0) return [];
  const longestLength = words.reduce((longest, word) => Math.max(longest, word.length), 0);
  return words.filter(word => word.length === longestLength);
}

export function findBoggleWordPath(word, board) {
  if (!/^[a-z]+$/.test(word) || !Array.isArray(board) ||
      board.length !== BOGGLE_BOARD_SIZE ** 2) return [];

  const search = (letterIndex, cellIndex, usedCells, path) => {
    if (board[cellIndex] !== word[letterIndex]) return null;
    const nextPath = [...path, cellIndex];
    if (letterIndex === word.length - 1) return nextPath;

    const row = Math.floor(cellIndex / BOGGLE_BOARD_SIZE);
    const column = cellIndex % BOGGLE_BOARD_SIZE;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (nextRow < 0 || nextRow >= BOGGLE_BOARD_SIZE ||
            nextColumn < 0 || nextColumn >= BOGGLE_BOARD_SIZE) continue;

        const nextIndex = nextRow * BOGGLE_BOARD_SIZE + nextColumn;
        const nextBit = 1 << nextIndex;
        if ((usedCells & nextBit) === 0) {
          const result = search(letterIndex + 1, nextIndex, usedCells | nextBit, nextPath);
          if (result) return result;
        }
      }
    }
    return null;
  };

  for (let index = 0; index < board.length; index++) {
    if (board[index] === word[0]) {
      const path = search(0, index, 1 << index, []);
      if (path) return path;
    }
  }
  return [];
}

export function isWordOnBoard(word, board) {
  if (!/^[a-z]+$/.test(word) || !Array.isArray(board) || board.length !== 16) return false;

  const search = (letterIndex, cellIndex, usedCells) => {
    if (board[cellIndex] !== word[letterIndex]) return false;
    if (letterIndex === word.length - 1) return true;

    const row = Math.floor(cellIndex / BOGGLE_BOARD_SIZE);
    const column = cellIndex % BOGGLE_BOARD_SIZE;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (nextRow < 0 || nextRow >= BOGGLE_BOARD_SIZE ||
            nextColumn < 0 || nextColumn >= BOGGLE_BOARD_SIZE) continue;

        const nextIndex = nextRow * BOGGLE_BOARD_SIZE + nextColumn;
        const nextBit = 1 << nextIndex;
        if ((usedCells & nextBit) === 0 &&
            search(letterIndex + 1, nextIndex, usedCells | nextBit)) return true;
      }
    }
    return false;
  };

  for (let index = 0; index < board.length; index++) {
    if (board[index] === word[0] && search(0, index, 1 << index)) return true;
  }
  return false;
}

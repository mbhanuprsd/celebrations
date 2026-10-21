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

export function getWordScore(playerCount) {
  if (playerCount <= 0) return 0;
  return playerCount === 1 ? 2 : 1;
}

export function calculateBoggleScores(playerOrder, submissions) {
  const scores = Object.fromEntries(playerOrder.map(uid => [uid, 0]));
  Object.values(submissions || {}).forEach(foundBy => {
    const players = playerOrder.filter(uid => foundBy?.[uid]);
    const points = getWordScore(players.length);
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

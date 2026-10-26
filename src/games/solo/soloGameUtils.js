export function parseUsedWords(stored, validWords) {
  if (!stored) return [];

  try {
    const words = JSON.parse(stored);
    return Array.isArray(words)
      ? words.filter(word => typeof word === 'string' && validWords.has(word))
      : [];
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.warn('Ignoring malformed Wordle used-word data.');
    return [];
  }
}

export function chooseTargetWord(words, usedWords, random = Math.random) {
  const availableWords = words.filter(word => !usedWords.includes(word));
  const wordList = availableWords.length > 0 ? availableWords : words;
  return wordList[Math.floor(random() * wordList.length)];
}

export function isAllowedGuess(guess, validWords) {
  return validWords.has(guess);
}

export function getLetterStatuses(targetWord, guess) {
  const statuses = Array(guess.length).fill('absent');
  const remainingLetters = new Map();

  for (let index = 0; index < targetWord.length; index++) {
    if (guess[index] === targetWord[index]) {
      statuses[index] = 'correct';
    } else {
      const letter = targetWord[index];
      remainingLetters.set(letter, (remainingLetters.get(letter) || 0) + 1);
    }
  }

  for (let index = 0; index < guess.length; index++) {
    if (statuses[index] === 'correct') continue;

    const remaining = remainingLetters.get(guess[index]) || 0;
    if (remaining > 0) {
      statuses[index] = 'present';
      remainingLetters.set(guess[index], remaining - 1);
    }
  }

  return statuses;
}

export function getFrameDelta(now, previousFrameTime) {
  if (previousFrameTime == null) return 1;
  return Math.min(Math.max(0, (now - previousFrameTime) / (1000 / 60)), 3);
}

export function advanceRacingScore(score, speed, frameDelta) {
  return score + speed * 0.1 * frameDelta;
}

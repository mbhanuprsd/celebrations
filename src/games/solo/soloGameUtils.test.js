import {
  chooseTargetWord,
  getFrameDelta,
  getLetterStatuses,
  isAllowedGuess,
  parseUsedWords,
} from './soloGameUtils';

describe('Wordle helpers', () => {
  test('ignores malformed and invalid persisted used-word data', () => {
    const validWords = new Set(['APPLE', 'GRAPE']);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseUsedWords('{bad json', validWords)).toEqual([]);
    expect(parseUsedWords('{"word":"APPLE"}', validWords)).toEqual([]);
    expect(parseUsedWords('["APPLE", 4, "UNKNOWN"]', validWords)).toEqual(['APPLE']);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  test('selects an unused word and cycles after all words are used', () => {
    const words = ['APPLE', 'GRAPE'];

    expect(chooseTargetWord(words, ['APPLE'], () => 0)).toBe('GRAPE');
    expect(chooseTargetWord(words, words, () => 0.75)).toBe('GRAPE');
  });

  test('validates guesses against the word list', () => {
    const validWords = new Set(['APPLE', 'GRAPE']);

    expect(isAllowedGuess('APPLE', validWords)).toBe(true);
    expect(isAllowedGuess('ZZZZZ', validWords)).toBe(false);
  });

  test('uses remaining letter counts when coloring duplicate guesses', () => {
    expect(getLetterStatuses('APPLE', 'ALLEY')).toEqual([
      'correct', 'present', 'absent', 'present', 'absent',
    ]);
    expect(getLetterStatuses('LEVEL', 'EERIE')).toEqual([
      'present', 'correct', 'absent', 'absent', 'absent',
    ]);
  });
});

describe('frame timing helper', () => {
  test('scales movement to a 60fps baseline', () => {
    expect(getFrameDelta(1000, 1000 - 1000 / 60)).toBeCloseTo(1);
    expect(getFrameDelta(1000, 1000 - 1000 / 120)).toBeCloseTo(0.5);
    expect(getFrameDelta(1000, 1000 - 1000 / 30)).toBeCloseTo(2);
  });

  test('uses a normal first frame and caps long pauses', () => {
    expect(getFrameDelta(1000, null)).toBe(1);
    expect(getFrameDelta(10000, 1000)).toBe(3);
  });
});

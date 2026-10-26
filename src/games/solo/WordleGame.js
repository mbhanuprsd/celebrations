import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import { saveSoloScore, getLocalSoloBest, WORD_BANK } from '../../firebase/services';
import { chooseTargetWord, getLetterStatuses, isAllowedGuess, parseUsedWords } from './soloGameUtils';

// Filter for 5-letter words only
const FIVE_LETTER_WORDS = WORD_BANK.en.filter(word => word.length === 5).map(word => word.toUpperCase());
const FIVE_LETTER_WORD_SET = new Set(FIVE_LETTER_WORDS);

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;
const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const getUsedWords = (userId) => {
  const key = `wordle_used_words_${userId}`;
  const stored = localStorage.getItem(key);
  return parseUsedWords(stored, FIVE_LETTER_WORD_SET);
};

const addUsedWord = (userId, word) => {
  const key = `wordle_used_words_${userId}`;
  const used = getUsedWords(userId);
  used.push(word);
  localStorage.setItem(key, JSON.stringify(used));
};

export const WordleGame = ({ onExit, userId, playerName }) => {
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameState, setGameState] = useState('playing'); // 'playing', 'won', 'lost'
  const [message, setMessage] = useState('');
  const [wordsFound, setWordsFound] = useState(0);
  const [validWords, setValidWords] = useState(FIVE_LETTER_WORD_SET);
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(`${process.env.PUBLIC_URL}/dictionaries/wordle-guesses.txt`)
      .then(response => {
        if (!response.ok) throw new Error(`Word list request failed (${response.status}).`);
        return response.text();
      })
      .then(contents => {
        const dictionaryWords = contents
          .split(/\s+/)
          .filter(word => /^[a-z]{5}$/i.test(word))
          .map(word => word.toUpperCase());
        if (dictionaryWords.length === 0) throw new Error('The word list was empty or invalid.');
        if (!active) return;
        setValidWords(new Set([...FIVE_LETTER_WORD_SET, ...dictionaryWords]));
        setDictionaryLoaded(true);
      })
      .catch(error => {
        if (!active) return;
        console.error('Failed to load the full Wordle guess list:', error);
        setMessage('Word list unavailable; only built-in words can be guessed.');
        setDictionaryLoaded(true);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Load current score (words found)
    const currentScore = Math.max(
      getLocalSoloBest(userId, 'wordle'),
      getLocalSoloBest(userId, 'Wordle')
    );
    setWordsFound(currentScore);

    // Select a new word
    const usedWords = getUsedWords(userId);
    setTargetWord(chooseTargetWord(FIVE_LETTER_WORDS, usedWords));
  }, [userId]);

  useEffect(() => {
    const currentScore = Math.max(
      getLocalSoloBest(userId, 'wordle'),
      getLocalSoloBest(userId, 'Wordle')
    );
    if (currentScore > getLocalSoloBest(userId, 'wordle')) {
      saveSoloScore(userId, playerName, 'wordle', currentScore);
    }
  }, [userId, playerName]);

  const handleSubmit = useCallback(() => {
    if (gameState !== 'playing') return;
    if (!dictionaryLoaded) {
      setMessage('Loading the word list…');
      return;
    }
    if (currentGuess.length !== WORD_LENGTH) {
      setMessage('Word must be 5 letters!');
      return;
    }
    if (!isAllowedGuess(currentGuess, validWords)) {
      setMessage('Word not in the word list!');
      return;
    }

    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');
    setMessage('');

    if (currentGuess === targetWord) {
      setGameState('won');
      addUsedWord(userId, targetWord);
      const newScore = wordsFound + 1;
      setWordsFound(newScore);
      saveSoloScore(userId, playerName, 'wordle', newScore);
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      setGameState('lost');
    }
  }, [currentGuess, dictionaryLoaded, gameState, guesses, targetWord, userId, wordsFound, playerName, validWords]);

  const handleKeyPress = useCallback((key) => {
    if (gameState !== 'playing' || !dictionaryLoaded) return;
    if (key === 'ENTER') {
      handleSubmit();
    } else if (key === 'BACKSPACE') {
      setCurrentGuess(current => current.slice(0, -1));
    } else if (/^[A-Z]$/.test(key)) {
      setCurrentGuess(current => current.length < WORD_LENGTH ? current + key : current);
    }
  }, [dictionaryLoaded, gameState, handleSubmit]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toUpperCase();
      if (event.key === 'Backspace') {
        event.preventDefault();
        handleKeyPress('BACKSPACE');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        handleKeyPress('ENTER');
      } else if (/^[A-Z]$/.test(key)) {
        handleKeyPress(key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyPress]);

  const resetGame = () => {
    const usedWords = getUsedWords(userId);
    setTargetWord(chooseTargetWord(FIVE_LETTER_WORDS, usedWords));
    setGuesses([]);
    setCurrentGuess('');
    setGameState('playing');
    setMessage('');
  };

  const getCellStyle = (color) => {
    switch (color) {
      case 'correct': return { backgroundColor: '#538d4e', color: 'white', borderColor: '#538d4e', boxShadow: '0 0 16px rgba(83,141,78,0.18)' };
      case 'present': return { backgroundColor: '#b59f3b', color: 'white', borderColor: '#b59f3b', boxShadow: '0 0 16px rgba(181,159,59,0.16)' };
      case 'absent': return { backgroundColor: '#3a3a3c', color: 'white', borderColor: '#3a3a3c' };
      case 'filled': return { backgroundColor: '#121213', color: 'white', borderColor: '#565758' };
      default: return { backgroundColor: '#121213', color: 'white', borderColor: '#3a3a3c' };
    }
  };

  const keyboardStatuses = {};
  guesses.forEach(guess => {
    getLetterStatuses(targetWord, guess).forEach((status, index) => {
      const letter = guess[index];
      if (status === 'correct' || (status === 'present' && keyboardStatuses[letter] !== 'correct') ||
        (!keyboardStatuses[letter] && status === 'absent')) {
        keyboardStatuses[letter] = status;
      }
    });
  });

  return (
    <Box sx={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      height: '100dvh',
      minHeight: 0,
      overflow: 'hidden',
      boxSizing: 'border-box',
      background: 'radial-gradient(ellipse at 50% -12%, rgba(83,141,78,0.18), transparent 48%), #121213',
      color: 'white',
      px: { xs: 1, sm: 2 },
      pt: 'max(8px, env(safe-area-inset-top))',
      pb: 'max(8px, env(safe-area-inset-bottom))',
    }}>
      <Box sx={{
        width: 'min(100%, 520px)', minHeight: 52, display: 'flex', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.12)', mb: 1,
      }}>
        <Button
          onClick={onExit}
          startIcon={<ArrowBackIcon />}
          sx={{ color: '#b1b3b5', minWidth: 0, px: 1, '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.06)' } }}
        >
          Exit
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{
          fontFamily: 'Georgia, serif', fontWeight: 700, letterSpacing: '0.08em',
          fontSize: { xs: '1.25rem', sm: '1.45rem' }, color: '#f8f8f8',
        }}>
          WORDLE
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{
          minWidth: 54, textAlign: 'center', px: 1, py: 0.55, borderRadius: '10px',
          border: '1px solid rgba(201,180,88,0.25)', background: 'rgba(201,180,88,0.08)',
        }}>
          <Typography sx={{ color: '#d6c56b', fontSize: '0.62rem', fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Solved
          </Typography>
          <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 900, lineHeight: 1.2, mt: 0.2 }}>
            {wordsFound}
          </Typography>
        </Box>
      </Box>

      <Typography sx={{ mb: 0.7, color: '#818384', fontSize: '0.72rem', letterSpacing: '0.02em' }}>
        Guess the word in 6 tries
      </Typography>

      <Box sx={{
        flex: 1, minHeight: 0, width: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', py: 0.5,
      }}>
        <Box sx={{
          display: 'grid', gridTemplateRows: `repeat(${MAX_ATTEMPTS}, minmax(0, 1fr))`,
          gap: { xs: '5px', sm: '7px' }, width: 'min(100%, 340px)',
          height: 'min(100%, 420px)', aspectRatio: '5 / 6',
        }}>
          {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
            const guess = guesses[rowIndex];
            const letterStatuses = guess ? getLetterStatuses(targetWord, guess) : [];
            const isCurrent = rowIndex === guesses.length;
            return (
              <Box key={rowIndex} sx={{ display: 'grid', gridTemplateColumns: `repeat(${WORD_LENGTH}, minmax(0, 1fr))`, gap: { xs: '5px', sm: '7px' } }}>
                {Array.from({ length: WORD_LENGTH }).map((_, colIndex) => {
                  const letter = isCurrent ? currentGuess[colIndex] : (guess ? guess[colIndex] : '');
                  const color = guess ? letterStatuses[colIndex] : (isCurrent && letter ? 'filled' : 'default');
                  return (
                    <motion.div
                      key={colIndex}
                      initial={guess ? { rotateX: -90, opacity: 0.6, scale: 0.92 } : { scale: letter ? 1.04 : 1 }}
                      animate={{ rotateX: 0, opacity: 1, scale: 1 }}
                      transition={guess ? { duration: 0.32, delay: colIndex * 0.1 } : { duration: 0.12 }}
                      style={{ perspective: 500, minWidth: 0, minHeight: 0 }}
                    >
                      <Box
                        aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}${letter ? `: ${letter}` : ''}`}
                        sx={{
                          width: '100%', height: '100%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: { xs: 'clamp(1rem, 5vw, 1.55rem)', sm: '1.65rem' },
                          fontWeight: 800, border: '2px solid', borderRadius: '4px',
                          transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
                          ...getCellStyle(color),
                        }}
                      >
                        {letter || ''}
                      </Box>
                    </motion.div>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      </Box>

      <AnimatePresence mode="wait">
        {(message || !dictionaryLoaded) && (
          <motion.div key={message || 'loading'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <Typography role="status" sx={{ color: message ? '#ffb400' : '#818384', fontWeight: 700, fontSize: '0.78rem', textAlign: 'center', py: 0.4 }}>
              {message || 'Loading word list…'}
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState !== 'playing' && (
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }} style={{ margin: '4px 0 10px' }}>
            <Box sx={{
              px: 2, py: 1, textAlign: 'center', borderRadius: '12px',
              bgcolor: gameState === 'won' ? 'rgba(83,141,78,0.12)' : 'rgba(120,124,126,0.12)',
              border: `1px solid ${gameState === 'won' ? 'rgba(106,170,100,0.35)' : 'rgba(120,124,126,0.3)'}`,
            }}>
              <Typography sx={{ mb: 0.8, fontWeight: 900, fontSize: '0.95rem' }}>
                {gameState === 'won' ? 'Excellent!' : `The word was ${targetWord}`}
              </Typography>
              <Button variant="contained" onClick={resetGame} sx={{
                background: 'linear-gradient(135deg, #538d4e, #6aaa64)', color: '#fff',
                fontWeight: 800, borderRadius: '8px', minHeight: 36,
              }}>
                Play again
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <Box
        role="group"
        aria-label="Wordle keyboard"
        sx={{
          width: 'min(100%, 500px)', flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: { xs: '7px', sm: '9px' },
          pt: 1,
        }}
      >
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <Box key={row} sx={{
            display: 'flex', justifyContent: 'center',
            gap: { xs: '4px', sm: '6px' }, px: rowIndex === 1 ? { xs: 1, sm: 2.5 } : 0,
          }}>
            {rowIndex === 2 && (
              <Button
                aria-label="Enter guess"
                onClick={() => handleKeyPress('ENTER')}
                disabled={gameState !== 'playing' || !dictionaryLoaded}
                sx={{
                  minWidth: { xs: 46, sm: 62 }, px: 0.6, borderRadius: '5px',
                  color: '#fff', background: '#818384', fontSize: { xs: '0.62rem', sm: '0.72rem' },
                  fontWeight: 800, '&:hover': { background: '#a3a5a6' },
                  '&.Mui-disabled': { color: '#777', background: '#3a3a3c' },
                }}
              >
                ENTER
              </Button>
            )}
            {row.split('').map(letter => {
              const status = keyboardStatuses[letter];
              const keyColor = status === 'correct' ? '#538d4e'
                : status === 'present' ? '#b59f3b'
                  : status === 'absent' ? '#3a3a3c' : '#818384';
              return (
                <Button
                  key={letter}
                  aria-label={`Type ${letter}`}
                  onClick={() => handleKeyPress(letter)}
                  disabled={gameState !== 'playing' || !dictionaryLoaded}
                  sx={{
                    flex: 1, minWidth: 0, maxWidth: { xs: 38, sm: 48 },
                    height: { xs: 'clamp(42px, 7vh, 54px)', sm: 56 },
                    px: 0, borderRadius: '5px', color: '#fff',
                    background: keyColor, fontSize: { xs: '0.82rem', sm: '0.95rem' },
                    fontWeight: 800, transition: 'background-color 0.2s, transform 0.12s',
                    '&:hover': { background: keyColor, filter: 'brightness(1.15)' },
                    '&:active': { transform: 'scale(0.94)' },
                    '&.Mui-disabled': { color: '#777', background: '#3a3a3c' },
                  }}
                >
                  {letter}
                </Button>
              );
            })}
            {rowIndex === 2 && (
              <Button
                aria-label="Delete last letter"
                onClick={() => handleKeyPress('BACKSPACE')}
                disabled={gameState !== 'playing' || !dictionaryLoaded}
                sx={{
                  minWidth: { xs: 46, sm: 62 }, px: 0.6, borderRadius: '5px',
                  color: '#fff', background: '#818384',
                  '&:hover': { background: '#a3a5a6' },
                  '&.Mui-disabled': { color: '#777', background: '#3a3a3c' },
                }}
              >
                <BackspaceOutlinedIcon fontSize="small" />
              </Button>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

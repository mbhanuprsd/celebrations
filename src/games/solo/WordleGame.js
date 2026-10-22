import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Grid, TextField } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { saveSoloScore, getLocalSoloBest, WORD_BANK } from '../../firebase/services';
import { chooseTargetWord, getLetterStatuses, isAllowedGuess, parseUsedWords } from './soloGameUtils';

// Filter for 5-letter words only
const FIVE_LETTER_WORDS = WORD_BANK.en.filter(word => word.length === 5).map(word => word.toUpperCase());
const FIVE_LETTER_WORD_SET = new Set(FIVE_LETTER_WORDS);

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

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

  const handleInputChange = (e) => {
    if (gameState !== 'playing') return;
    const value = e.target.value.toUpperCase().slice(0, WORD_LENGTH);
    setCurrentGuess(value);
  };

  const handleSubmit = () => {
    if (gameState !== 'playing') return;
    if (currentGuess.length !== WORD_LENGTH) {
      setMessage('Word must be 5 letters!');
      return;
    }
    if (!isAllowedGuess(currentGuess, FIVE_LETTER_WORD_SET)) {
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
  };

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
      case 'correct': return { backgroundColor: '#6aaa64', color: 'white' };
      case 'present': return { backgroundColor: '#c9b458', color: 'white' };
      case 'absent': return { backgroundColor: '#787c7e', color: 'white' };
      default: return { backgroundColor: '#d3d6da', color: 'black' };
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      backgroundColor: '#121213', 
      color: 'white',
      p: 2
    }}>
      <Button 
        onClick={onExit} 
        startIcon={<ArrowBackIcon />} 
        sx={{ alignSelf: 'flex-start', color: 'white', mb: 2 }}
      >
        Back
      </Button>

      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', letterSpacing: 2 }}>
        WORDLE
      </Typography>

      <Typography variant="h6" sx={{ mb: 4, color: '#c9b458' }}>
        Words Found: {wordsFound}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateRows: `repeat(${MAX_ATTEMPTS}, 1fr)`, gap: 1, mb: 4 }}>
        {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
          const guess = guesses[rowIndex];
          const letterStatuses = guess ? getLetterStatuses(targetWord, guess) : [];
          const isCurrent = rowIndex === guesses.length;
          
          return (
            <Grid container spacing={1} key={rowIndex}>
              {Array.from({ length: WORD_LENGTH }).map((_, colIndex) => {
                const letter = isCurrent ? currentGuess[colIndex] : (guess ? guess[colIndex] : '');
                const color = guess ? letterStatuses[colIndex] : 'default';
                return (
                  <Box 
                    key={colIndex} 
                    sx={{ 
                      width: 50, 
                      height: 50, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      border: '2px solid #3a3a3c', 
                      borderRadius: 1,
                      ...getCellStyle(color)
                    }}
                  >
                    {letter || ''}
                  </Box>
                );
              })}
            </Grid>
          );
        })}
      </Box>

      {gameState === 'playing' && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField 
            value={currentGuess} 
            onChange={handleInputChange} 
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            variant="outlined" 
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                color: 'white', 
                backgroundColor: '#121213', 
                '& fieldset': { borderColor: '#3a3a3c' } 
              } 
            }}
            placeholder="Enter word"
          />
          <Button variant="contained" onClick={handleSubmit} sx={{ backgroundColor: '#538d4e', '&:hover': { backgroundColor: '#467a42' } }}>
            Enter
          </Button>
        </Box>
      )}

      {gameState !== 'playing' && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            {gameState === 'won' ? '🎉 You Won!' : `Game Over! Word was ${targetWord}`}
          </Typography>
          <Button variant="contained" onClick={resetGame} sx={{ backgroundColor: '#538d4e' }}>
            Play Again
          </Button>
        </Box>
      )}

      {message && <Typography sx={{ mt: 2, color: '#ffb400' }}>{message}</Typography>}
    </Box>
  );
};

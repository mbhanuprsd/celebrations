// src/games/solo/HangmanGame.js
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { saveSoloScore, getLocalSoloBest, WORD_BANK } from '../../firebase/services';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_WRONG = 8;
const ALL_WORDS = WORD_BANK.en.filter(w => w.length >= 4 && w.length <= 8 && /^[a-z]+$/.test(w));

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

// ─── Hangman SVG drawing ──────────────────────────────────────────────────────
function HangmanDrawing({ wrongCount }) {
  const s = { stroke: '#e8eaf6', strokeWidth: 2.5, strokeLinecap: 'round' };
  const bodyColor = '#EF476F';
  const bs = { stroke: bodyColor, strokeWidth: 2.5, strokeLinecap: 'round' };

  return (
    <svg viewBox="0 0 160 180" width="160" height="180" style={{ display: 'block', margin: '0 auto' }}>
      {/* Gallows */}
      <line x1="20" y1="170" x2="140" y2="170" {...s} />
      <line x1="60" y1="170" x2="60" y2="10" {...s} />
      <line x1="60" y1="10" x2="110" y2="10" {...s} />
      <line x1="110" y1="10" x2="110" y2="30" {...s} />

      {/* 1 — Head */}
      {wrongCount >= 1 && (
        <circle cx="110" cy="42" r="12" fill="none" {...bs} />
      )}
      {/* 2 — Body */}
      {wrongCount >= 2 && (
        <line x1="110" y1="54" x2="110" y2="100" {...bs} />
      )}
      {/* 3 — Left arm */}
      {wrongCount >= 3 && (
        <line x1="110" y1="65" x2="88" y2="85" {...bs} />
      )}
      {/* 4 — Right arm */}
      {wrongCount >= 4 && (
        <line x1="110" y1="65" x2="132" y2="85" {...bs} />
      )}
      {/* 5 — Left leg */}
      {wrongCount >= 5 && (
        <line x1="110" y1="100" x2="90" y2="122" {...bs} />
      )}
      {/* 6 — Right leg */}
      {wrongCount >= 6 && (
        <line x1="110" y1="100" x2="130" y2="122" {...bs} />
      )}
      {/* 7 — Left foot */}
      {wrongCount >= 7 && (
        <line x1="90" y1="122" x2="78" y2="128" {...bs} />
      )}
      {/* 8 — Right foot */}
      {wrongCount >= 8 && (
        <line x1="130" y1="122" x2="142" y2="128" {...bs} />
      )}
    </svg>
  );
}

// ─── Pick a random word ───────────────────────────────────────────────────────
function pickWord() {
  return ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)].toLowerCase();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function HangmanGame({ onExit, userId, playerName }) {
  const [word, setWord]           = useState(() => pickWord());
  const [guessed, setGuessed]     = useState(new Set());
  const [score, setScore]         = useState(0);
  const [streak, setStreak]       = useState(0);
  const [phase, setPhase]         = useState('playing'); // 'playing' | 'won' | 'lost' | 'gameover'
  const [bestScore, setBestScore] = useState(() => getLocalSoloBest(userId, 'hangman'));
  const [lastPoints, setLastPoints] = useState(null);

  const wrongLetters  = [...guessed].filter(l => !word.includes(l));
  const wrongCount    = wrongLetters.length;
  const isWordSolved  = word.split('').every(l => guessed.has(l));
  const isGameLost    = wrongCount >= MAX_WRONG;

  // ── Detect round end ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    if (isWordSolved) {
      // Points: base 100 + length bonus + speed bonus (letters remaining)
      const bonus = (word.length - 3) * 10;
      const remaining = MAX_WRONG - wrongCount;
      const points = 100 + bonus + remaining * 15;
      setLastPoints(points);
      setScore(prev => prev + points);
      setStreak(prev => prev + 1);
      setPhase('won');
    } else if (isGameLost) {
      setStreak(0);
      setPhase('lost');
    }
  }, [isWordSolved, isGameLost, phase, word, wrongCount]);

  // ── Save score on game over ───────────────────────────────────────────────
  const handleGameOver = useCallback(() => {
    if (score > 0) {
      saveSoloScore(userId, playerName, 'hangman', score);
      if (score > bestScore) setBestScore(score);
    }
    setPhase('gameover');
  }, [score, userId, playerName, bestScore]);

  const handleNextWord = () => {
    setWord(pickWord());
    setGuessed(new Set());
    setLastPoints(null);
    setPhase('playing');
  };

  const handleGuess = (letter) => {
    if (phase !== 'playing' || guessed.has(letter)) return;
    setGuessed(prev => new Set([...prev, letter]));
  };

  // ── Keyboard support ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const letter = e.key.toLowerCase();
      if (/^[a-z]$/.test(letter)) handleGuess(letter);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const accentColor = '#c77dff';
  const wonColor    = '#06D6A0';
  const lostColor   = '#EF476F';

  // ─── Game Over Screen ───────────────────────────────────────────────────────
  if (phase === 'gameover') {
    const isNewBest = score >= bestScore && score > 0;
    return (
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: 'linear-gradient(180deg, #0d1117 0%, #161b22 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        p: 3,
      }}>
        <Typography sx={{ fontSize: '3rem', mb: 1 }}>💀</Typography>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: lostColor, mb: 0.5 }}>
          Game Over
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: '#8b949e', mb: 3 }}>
          The word was <span style={{ color: '#fff', fontWeight: 700 }}>{word.toUpperCase()}</span>
        </Typography>

        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography sx={{ fontSize: '2.8rem', fontWeight: 900, color: accentColor, lineHeight: 1 }}>
            {score}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Final Score
          </Typography>
          {isNewBest && (
            <Typography sx={{ fontSize: '0.8rem', color: '#FFD166', fontWeight: 700, mt: 0.5 }}>
              🏆 New Best!
            </Typography>
          )}
        </Box>

        <Button
          variant="contained"
          onClick={onExit}
          startIcon={<ArrowBackIcon />}
          sx={{ background: 'rgba(255,255,255,0.07)', color: '#8b949e', borderRadius: '12px', px: 3, py: 1.2, fontWeight: 700, mr: 1 }}
        >
          Exit
        </Button>
      </Box>
    );
  }

  // ─── Main Game UI ───────────────────────────────────────────────────────────
  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 1300,
      background: 'linear-gradient(180deg, #0d1117 0%, #161b22 100%)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 2, pb: 1, gap: 1 }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={onExit}
          sx={{ color: '#8b949e', fontSize: '0.75rem', minWidth: 0, p: '4px 8px',
            '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.05)' } }}
        >
          Exit
        </Button>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: accentColor, lineHeight: 1 }}>
            {score}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            score
          </Typography>
        </Box>
        {streak > 1 && (
          <Box sx={{ ml: 1.5, px: 1, py: 0.3, borderRadius: '8px', background: 'rgba(255,209,102,0.12)', border: '1px solid rgba(255,209,102,0.3)' }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#FFD166', fontWeight: 800 }}>
              🔥 {streak}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Hangman drawing */}
      <Box sx={{ py: 0.5 }}>
        <HangmanDrawing wrongCount={wrongCount} />
        {/* Wrong tries counter */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
          {Array.from({ length: MAX_WRONG }).map((_, i) => (
            <Box key={i} sx={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < wrongCount ? lostColor : 'rgba(255,255,255,0.1)',
              border: `1px solid ${i < wrongCount ? lostColor : 'rgba(255,255,255,0.15)'}`,
              transition: 'all 0.2s',
            }} />
          ))}
        </Box>
      </Box>

      {/* Word display */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.8, px: 2, py: 1.5, flexWrap: 'wrap' }}>
        {word.split('').map((letter, i) => {
          const revealed = guessed.has(letter) || phase === 'lost' || phase === 'gameover';
          const isNew = phase === 'won' && guessed.has(letter) && !wrongLetters.includes(letter);
          return (
            <Box key={i} sx={{
              width: Math.max(28, 42 - word.length * 2),
              borderBottom: `2px solid ${revealed ? (phase === 'lost' ? lostColor : accentColor) : 'rgba(255,255,255,0.2)'}`,
              textAlign: 'center', pb: 0.3,
              transition: 'border-color 0.2s',
            }}>
              <Typography sx={{
                fontSize: Math.max(0.9, 1.4 - word.length * 0.04) + 'rem',
                fontWeight: 900, color: revealed ? (phase === 'lost' && !guessed.has(letter) ? lostColor : '#e8eaf6') : 'transparent',
                letterSpacing: '0.05em',
                animation: isNew ? 'none' : undefined,
              }}>
                {letter.toUpperCase()}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Category hint */}
      <Typography sx={{ textAlign: 'center', color: '#484f58', fontSize: '0.65rem', mb: 0.5 }}>
        {word.length} letters
      </Typography>

      {/* Wrong guesses */}
      {wrongLetters.length > 0 && (
        <Typography sx={{ textAlign: 'center', color: lostColor + 'aa', fontSize: '0.68rem', mb: 0.5, letterSpacing: '0.15em' }}>
          Wrong: {wrongLetters.join(' ')}
        </Typography>
      )}

      {/* Outcome overlay */}
      {(phase === 'won' || phase === 'lost') && (
        <Box sx={{
          mx: 2, mb: 1.5, p: 1.5, borderRadius: '14px',
          background: phase === 'won' ? 'rgba(6,214,160,0.1)' : 'rgba(239,71,111,0.1)',
          border: `1px solid ${phase === 'won' ? wonColor + '40' : lostColor + '40'}`,
          textAlign: 'center',
        }}>
          {phase === 'won' ? (
            <>
              <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: wonColor }}>
                ✓ Correct! +{lastPoints} pts
              </Typography>
              <Button
                size="small" variant="contained"
                onClick={handleNextWord}
                sx={{ mt: 1, background: wonColor, color: '#0d1117', fontWeight: 800, borderRadius: '10px', px: 3 }}
              >
                Next Word →
              </Button>
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: lostColor }}>
                The word was <strong>{word.toUpperCase()}</strong>
              </Typography>
              <Button
                size="small" variant="contained"
                onClick={handleGameOver}
                sx={{ mt: 1, background: lostColor, color: '#fff', fontWeight: 800, borderRadius: '10px', px: 3 }}
              >
                End Game
              </Button>
            </>
          )}
        </Box>
      )}

      {/* Alphabet keyboard */}
      <Box sx={{ px: 1, pb: 2, mt: 'auto' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, justifyContent: 'center' }}>
          {ALPHABET.map(letter => {
            const isGuessed   = guessed.has(letter);
            const isCorrect   = isGuessed && word.includes(letter);
            const isWrong     = isGuessed && !word.includes(letter);
            const isDisabled  = isGuessed || phase !== 'playing';
            return (
              <Box
                key={letter}
                onClick={() => !isDisabled && handleGuess(letter)}
                sx={{
                  width: 44, height: 44, borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isDisabled ? 'default' : 'pointer',
                  fontWeight: 800, fontSize: '1rem',
                  userSelect: 'none',
                  transition: 'all 0.12s',
                  background: isCorrect
                    ? 'rgba(6,214,160,0.25)'
                    : isWrong
                    ? 'rgba(239,71,111,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  border: isCorrect
                    ? `1.5px solid ${wonColor}60`
                    : isWrong
                    ? `1.5px solid ${lostColor}40`
                    : '1.5px solid rgba(255,255,255,0.2)',
                  color: isCorrect ? wonColor : isWrong ? lostColor + '80' : '#c9d1d9',
                  opacity: isDisabled ? 0.35 : 1,
                  '&:hover': !isDisabled ? {
                    background: `${accentColor}25`,
                    border: `1.5px solid ${accentColor}70`,
                    color: accentColor,
                    transform: 'scale(1.1)',
                    boxShadow: `0 0 12px ${accentColor}30`,
                  } : {},
                }}
              >
                {letter}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
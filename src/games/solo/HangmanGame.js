// src/games/solo/HangmanGame.js
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { saveSoloScore, getLocalSoloBest, WORD_BANK } from '../../firebase/services';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_WRONG = 8;
const ALL_WORDS = WORD_BANK.en.filter(w => w.length >= 4 && w.length <= 8 && /^[a-z]+$/.test(w));

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

// ─── Hangman SVG drawing ──────────────────────────────────────────────────────
function HangmanDrawing({ wrongCount, reduceMotion }) {
  const s = { stroke: '#e8eaf6', strokeWidth: 2.5, strokeLinecap: 'round' };
  const bodyColor = wrongCount >= MAX_WRONG ? '#ff5c7a' : '#c77dff';
  const bs = { stroke: bodyColor, strokeWidth: 2.5, strokeLinecap: 'round' };
  const drawTransition = (duration, delay = 0) => ({
    duration: reduceMotion ? 0 : duration,
    delay: reduceMotion ? 0 : delay,
    ease: 'easeOut',
  });

  return (
    <svg viewBox="0 0 160 180" role="img" aria-label={`Hangman drawing, ${wrongCount} of ${MAX_WRONG} wrong guesses`}
      style={{ display: 'block', width: 'min(180px, 45vw)', maxHeight: '25dvh', height: 'auto', margin: '0 auto', overflow: 'visible' }}>
      {/* Gallows */}
      <motion.line x1="20" y1="170" x2="140" y2="170" {...s} initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.35)} />
      <motion.line x1="60" y1="170" x2="60" y2="10" {...s} initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.4, 0.08)} />
      <motion.line x1="60" y1="10" x2="110" y2="10" {...s} initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.25, 0.18)} />
      <motion.line x1="110" y1="10" x2="110" y2="30" {...s} initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.2, 0.28)} />

      {/* 1 — Head */}
      {wrongCount >= 1 && (
        <motion.circle cx="110" cy="42" r="12" fill="none" {...bs}
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
          transition={drawTransition(0.35)} />
      )}
      {/* 2 — Body */}
      {wrongCount >= 2 && (
        <motion.line x1="110" y1="54" x2="110" y2="100" {...bs}
          initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.3)} />
      )}
      {/* 3 — Left arm */}
      {wrongCount >= 3 && (
        <motion.line x1="110" y1="65" x2="88" y2="85" {...bs}
          initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.28)} />
      )}
      {/* 4 — Right arm */}
      {wrongCount >= 4 && (
        <motion.line x1="110" y1="65" x2="132" y2="85" {...bs}
          initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.28)} />
      )}
      {/* 5 — Left leg */}
      {wrongCount >= 5 && (
        <motion.line x1="110" y1="100" x2="90" y2="122" {...bs}
          initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.28)} />
      )}
      {/* 6 — Right leg */}
      {wrongCount >= 6 && (
        <motion.line x1="110" y1="100" x2="130" y2="122" {...bs}
          initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.28)} />
      )}
      {/* 7 — Left foot */}
      {wrongCount >= 7 && (
        <motion.line x1="90" y1="122" x2="78" y2="128" {...bs}
          initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.24)} />
      )}
      {/* 8 — Right foot */}
      {wrongCount >= 8 && (
        <motion.line x1="130" y1="122" x2="142" y2="128" {...bs}
          initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={drawTransition(0.24)} />
      )}
      {wrongCount >= MAX_WRONG && (
        <motion.g initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
          transition={drawTransition(0.2)} style={{ transformOrigin: '110px 42px' }}>
          <circle cx="106" cy="40" r="1.4" fill={bodyColor} />
          <circle cx="114" cy="40" r="1.4" fill={bodyColor} />
          <path d="M106 48 Q110 44 114 48" fill="none" {...bs} strokeWidth="1.8" />
        </motion.g>
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
  const reduceMotion = useReducedMotion();
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

  const handleGuess = useCallback((letter) => {
    if (phase !== 'playing' || guessed.has(letter)) return;
    setGuessed(prev => new Set([...prev, letter]));
  }, [guessed, phase]);

  // ── Keyboard support ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const letter = e.key.toLowerCase();
      if (/^[a-z]$/.test(letter)) handleGuess(letter);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleGuess]);

  const accentColor = '#c77dff';
  const wonColor    = '#06D6A0';
  const lostColor   = '#EF476F';

  // ─── Game Over Screen ───────────────────────────────────────────────────────
  if (phase === 'gameover') {
    const isNewBest = score >= bestScore && score > 0;
    return (
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 1300,
        boxSizing: 'border-box',
        pt: 'max(16px, env(safe-area-inset-top))',
        pb: 'max(16px, env(safe-area-inset-bottom))',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(199,125,255,0.12), transparent 48%), linear-gradient(180deg, #0d1117 0%, #161b22 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        px: 2, overflowY: 'auto',
      }}>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.3 }}
          style={{ width: 'min(100%, 380px)' }}
        >
          <Box sx={{
            p: { xs: 3, sm: 4 }, textAlign: 'center', borderRadius: '26px',
            bgcolor: 'rgba(17,22,32,0.94)', border: '1px solid rgba(199,125,255,0.2)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 50px rgba(199,125,255,0.08)',
          }}>
            <Typography sx={{ fontSize: '3rem', mb: 1 }}>💀</Typography>
            <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: lostColor, mb: 0.5 }}>
              Game Over
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#8b949e', mb: 2 }}>
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
            <Button variant="contained" onClick={onExit} startIcon={<ArrowBackIcon />}
              sx={{ background: 'linear-gradient(135deg, #c77dff, #7209B7)', color: '#fff', borderRadius: '12px', px: 3, py: 1.2, fontWeight: 800 }}>
              Back to Games
            </Button>
          </Box>
        </motion.div>
      </Box>
    );
  }

  // ─── Main Game UI ───────────────────────────────────────────────────────────
  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 1300,
      boxSizing: 'border-box',
      px: { xs: 1.2, sm: 2 },
      pt: 'max(8px, env(safe-area-inset-top))',
      pb: 'max(8px, env(safe-area-inset-bottom))',
      background: 'radial-gradient(ellipse at 50% 25%, rgba(199,125,255,0.09), transparent 55%), linear-gradient(180deg, #0d1117 0%, #161b22 100%)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <Box sx={{
        width: 'min(100%, 480px)', mx: 'auto', display: 'flex', alignItems: 'center',
        px: 0.5, pt: 0.5, pb: 1, gap: 1, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={onExit}
          sx={{ color: '#8b949e', fontSize: '0.75rem', minWidth: 0, minHeight: 40, p: '4px 8px',
            '&:hover': { color: '#fff', background: 'rgba(255,255,255,0.05)' } }}
        >
          Exit
        </Button>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography sx={{ color: '#f0e7ff', fontSize: '0.98rem', fontWeight: 900, letterSpacing: '0.13em' }}>
            HANGMAN
          </Typography>
          <Typography sx={{ color: '#666078', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
            Guess the mystery word
          </Typography>
        </Box>
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

      <Box sx={{
        width: 'min(100%, 480px)', mx: 'auto', flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {/* Tries and gallows */}
        <motion.div
          initial={false}
          animate={reduceMotion || wrongCount === 0 ? { x: 0 } : { x: [0, -5, 5, -3, 3, 0] }}
          transition={{ duration: reduceMotion ? 0 : 0.28 }}
        >
          <Box sx={{
            position: 'relative', py: { xs: 0.5, sm: 1 }, mx: 'auto',
            width: 'min(100%, 420px)', borderRadius: '24px',
            background: 'linear-gradient(145deg, rgba(199,125,255,0.1), rgba(255,255,255,0.018))',
            border: '1px solid rgba(199,125,255,0.15)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.24), inset 0 1px rgba(255,255,255,0.03)',
            overflow: 'hidden',
          }}>
            <Box sx={{
              position: 'absolute', top: 0, left: '12%', right: '12%', height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(199,125,255,0.5), transparent)',
            }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.8, pt: 1 }}>
              <Box>
                <Typography sx={{ color: '#f0e7ff', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.08em' }}>
                  MYSTERY WORD
                </Typography>
                <Typography sx={{ color: '#716b80', fontSize: '0.62rem', mt: 0.2 }}>
                  {word.length} letters
                </Typography>
              </Box>
              <Box sx={{
                px: 1.2, py: 0.45, borderRadius: '10px',
                bgcolor: wrongCount >= MAX_WRONG - 2 ? 'rgba(239,71,111,0.12)' : 'rgba(199,125,255,0.1)',
                border: `1px solid ${wrongCount >= MAX_WRONG - 2 ? 'rgba(239,71,111,0.28)' : 'rgba(199,125,255,0.2)'}`,
              }}>
                <Typography sx={{
                  color: wrongCount >= MAX_WRONG - 2 ? lostColor : '#d6b8ff',
                  fontSize: '0.68rem', fontWeight: 900,
                }}>
                  {MAX_WRONG - wrongCount} {MAX_WRONG - wrongCount === 1 ? 'TRY' : 'TRIES'} LEFT
                </Typography>
              </Box>
            </Box>

            <HangmanDrawing wrongCount={wrongCount} reduceMotion={reduceMotion} />

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.55, pb: 1.4 }}>
              {Array.from({ length: MAX_WRONG }).map((_, i) => (
                <motion.div key={i} initial={false}
                  animate={i < wrongCount
                    ? { scale: [1, 1.35, 1], backgroundColor: lostColor }
                    : { scale: 1, backgroundColor: 'rgba(255,255,255,0.08)' }}
                  transition={{ duration: reduceMotion ? 0 : 0.22 }}>
                  <Box sx={{
                    width: 16, height: 5, borderRadius: 4,
                    border: `1px solid ${i < wrongCount ? lostColor + '80' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: i < wrongCount ? `0 0 9px ${lostColor}55` : 'none',
                  }} />
                </motion.div>
              ))}
            </Box>
          </Box>
        </motion.div>

        {/* Word display */}
        <Box sx={{
          display: 'flex', justifyContent: 'center',
          gap: { xs: 0.55, sm: 0.8 }, px: 0.5, py: { xs: 1.3, sm: 1.8 }, flexWrap: 'nowrap',
        }}>
          {word.split('').map((letter, i) => {
            const revealed = guessed.has(letter) || phase === 'lost' || phase === 'gameover';
            const missed = (phase === 'lost' || phase === 'gameover') && !guessed.has(letter);
            return (
              <motion.div key={`${letter}-${i}`} layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={revealed
                  ? { opacity: 1, y: 0, scale: [1, 1.12, 1], rotateX: [90, 0] }
                  : { opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : i * 0.035 }}>
                <Box sx={{
                  width: `min(${Math.max(34, 50 - word.length * 2)}px, 10.5vw)`,
                  height: { xs: 48, sm: 56 }, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '12px',
                  border: `1.5px solid ${revealed ? (missed ? lostColor + '80' : accentColor + '70') : 'rgba(255,255,255,0.12)'}`,
                  background: revealed ? (missed ? 'rgba(239,71,111,0.1)' : 'rgba(199,125,255,0.12)') : 'rgba(255,255,255,0.025)',
                  boxShadow: revealed ? `0 5px 16px ${missed ? lostColor : accentColor}18` : 'inset 0 -3px rgba(255,255,255,0.04)',
                  transformStyle: 'preserve-3d',
                }}>
                  <Typography sx={{
                    fontSize: { xs: '1.3rem', sm: '1.55rem' }, fontWeight: 900,
                    color: missed ? lostColor : revealed ? '#f5efff' : 'transparent', lineHeight: 1,
                  }}>
                    {letter.toUpperCase()}
                  </Typography>
                </Box>
              </motion.div>
            );
          })}
        </Box>

      </Box>

      {/* Outcome overlay */}
      {(phase === 'won' || phase === 'lost') && (
        <AnimatePresence mode="wait">
        <motion.div key={phase} initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
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
        </motion.div>
        </AnimatePresence>
      )}

      {/* Alphabet keyboard */}
      <Box role="group" aria-label="Hangman letter keyboard" sx={{
        width: 'min(100%, 480px)', mx: 'auto', flexShrink: 0,
        px: { xs: 0, sm: 1 }, pt: 0.8, pb: 0.5,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: '6px', sm: '8px' } }}>
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <Box key={row} sx={{
              display: 'flex', justifyContent: 'center',
              gap: { xs: '4px', sm: '7px' }, px: rowIndex === 1 ? { xs: 1.2, sm: 3 } : 0,
            }}>
          {row.split('').map(letter => {
            const isGuessed   = guessed.has(letter);
            const isCorrect   = isGuessed && word.includes(letter);
            const isWrong     = isGuessed && !word.includes(letter);
            const isDisabled  = isGuessed || phase !== 'playing';
            return (
              <motion.div key={letter}
                whileTap={!isDisabled && !reduceMotion ? { scale: 0.9, y: 2 } : undefined}
                initial={false}
                animate={isGuessed
                  ? { y: [0, -4, 0], scale: [1, 1.12, 1] }
                  : { y: 0, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}>
              <Button
                onClick={() => !isDisabled && handleGuess(letter)}
                disabled={isDisabled}
                aria-label={`${letter.toUpperCase()}${isCorrect ? ', correct' : isWrong ? ', incorrect' : ''}`}
                sx={{
                  minWidth: 0, width: { xs: 'clamp(27px, 8.8vw, 40px)', sm: 43 },
                  height: { xs: 'clamp(42px, 6.4vh, 52px)', sm: 52 },
                  px: 0, borderRadius: { xs: '9px', sm: '11px' },
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: { xs: '0.82rem', sm: '0.95rem' },
                  userSelect: 'none', transition: 'all 0.16s ease',
                  boxShadow: isCorrect ? `0 0 14px ${wonColor}30` : '0 3px 8px rgba(0,0,0,0.16)',
                  touchAction: 'manipulation',
                  background: isCorrect
                    ? 'linear-gradient(145deg, rgba(6,214,160,0.22), rgba(6,214,160,0.12))'
                    : isWrong
                    ? 'rgba(239,71,111,0.12)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.045))',
                  border: isCorrect
                    ? `1.5px solid ${wonColor}60`
                    : isWrong
                    ? `1.5px solid ${lostColor}40`
                    : '1.5px solid rgba(255,255,255,0.1)',
                  color: isCorrect ? wonColor : isWrong ? lostColor + '80' : '#c9d1d9',
                  opacity: isDisabled && !isGuessed ? 0.35 : 1,
                  '&:hover': !isDisabled ? {
                    background: `${accentColor}25`,
                    border: `1.5px solid ${accentColor}70`,
                    color: accentColor,
                    boxShadow: `0 0 12px ${accentColor}30`,
                  } : {},
                  '&.Mui-disabled': {
                    color: isCorrect ? wonColor : isWrong ? lostColor + '90' : 'rgba(230,225,238,0.3)',
                    background: isCorrect ? 'rgba(6,214,160,0.16)' : isWrong ? 'rgba(239,71,111,0.1)' : 'rgba(255,255,255,0.035)',
                    borderColor: isCorrect ? `${wonColor}55` : isWrong ? `${lostColor}35` : 'rgba(255,255,255,0.06)',
                  },
                }}
              >
                {letter.toUpperCase()}
              </Button>
              </motion.div>
            );
          })}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
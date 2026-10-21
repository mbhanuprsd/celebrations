import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';
import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { useGameGuard } from '../../hooks/useGameSession';
import { LeaveConfirmModal, OfflineBanner } from '../../components/GameSharedUI';
import { loadBoggleDictionary, submitBoggleWord, finishBoggleRound, initBoggleGame } from './boggleFirebaseService';
import { extendBogglePath, getWordScore, isWordOnBoard } from './boggleConstants';

const ACCENT = '#06D6A0';

export function BoggleGame() {
  const { state, notify } = useGameContext();
  const { leave } = useRoom();
  const { room, roomId, userId, isHost } = state;
  const notifyRef = useRef(notify);
  const game = room?.boggleState;
  const { online, confirmOpen, requestLeave, cancelLeave, confirmLeave } = useGameGuard({
    roomId, userId, gameType: 'boggle', leaveCallback: leave,
  });

  const [dictionary, setDictionary] = useState(null);
  const [dictionaryError, setDictionaryError] = useState('');
  const [selectedPath, setSelectedPath] = useState([]);
  const [wordFeedback, setWordFeedback] = useState(null);
  const [feedbackPath, setFeedbackPath] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [playingAgain, setPlayingAgain] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const finishStartedRef = useRef(false);
  const boardRef = useRef(null);
  const pathRef = useRef([]);
  const pointerIdRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  useEffect(() => () => clearTimeout(feedbackTimerRef.current), []);

  useEffect(() => {
    let active = true;
    loadBoggleDictionary().then(words => {
      if (active) {
        setDictionary(words);
        setDictionaryError('');
      }
    }).catch(error => {
      if (active) setDictionaryError(error.message || 'Could not load the word list.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!game?.endsAt || game.phase !== 'playing') return undefined;
    finishStartedRef.current = false;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((game.endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && !finishStartedRef.current) {
        finishStartedRef.current = true;
        finishBoggleRound(roomId).then(finished => {
          if (!finished) finishStartedRef.current = false;
        }).catch(error => {
          finishStartedRef.current = false;
          notifyRef.current(error.message || 'Could not finish the round.', 'error');
        });
      }
    };
    tick();
    const timerId = setInterval(tick, 250);
    return () => clearInterval(timerId);
  }, [game?.endsAt, game?.phase, roomId]);

  const submissions = game?.submissions || {};
  const myWords = useMemo(() => Object.entries(submissions)
    .filter(([, foundBy]) => foundBy?.[userId])
    .map(([foundWord, foundBy]) => ({ word: foundWord, shared: Object.keys(foundBy).length > 1 }))
    .sort((a, b) => a.word.localeCompare(b.word)), [submissions, userId]);

  const players = game?.playerOrder || [];
  const sortedPlayers = [...players].sort(
    (a, b) => (game?.scores?.[b] || 0) - (game?.scores?.[a] || 0)
  );
  const wordsFoundBy = uid => Object.values(submissions)
    .filter(foundBy => foundBy?.[uid]).length;

  const showWordFeedback = (message, status, rawWord, path = []) => {
    clearTimeout(feedbackTimerRef.current);
    setFeedbackPath(path);
    setWordFeedback({ message, status, word: rawWord, id: Date.now() });
    feedbackTimerRef.current = setTimeout(() => {
      setWordFeedback(null);
      setFeedbackPath([]);
    }, 1400);
  };

  const handleSubmit = async (rawWord, path = []) => {
    const normalized = rawWord.trim().toLowerCase();
    if (!normalized) return;
    if (!/^[a-z]+$/.test(normalized)) {
      showWordFeedback('Letters A–Z only', 'wrong', normalized, path);
      return;
    }
    if (!dictionary) {
      showWordFeedback(dictionaryError || 'Dictionary is still loading', 'wrong', normalized, path);
      return;
    }
    if (normalized.length < game.minWordLength) {
      showWordFeedback(`At least ${game.minWordLength} letters`, 'wrong', normalized, path);
      return;
    }
    if (!dictionary.has(normalized)) {
      showWordFeedback('Not in the dictionary', 'wrong', normalized, path);
      return;
    }
    if (!isWordOnBoard(normalized, game.board)) {
      showWordFeedback('Not a valid path on this board', 'wrong', normalized, path);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitBoggleWord(roomId, userId, normalized, dictionary);
      if (result.accepted) {
        showWordFeedback(
          `Valid · +${getWordScore(1)} unique, +${getWordScore(2)} shared`,
          'correct',
          normalized,
          path
        );
      } else if (result.error) {
        showWordFeedback(result.error, 'wrong', normalized, path);
      }
    } catch (error) {
      showWordFeedback(error.message || 'Could not submit that word', 'wrong', normalized, path);
    } finally {
      setSubmitting(false);
    }
  };

  const updatePath = nextIndex => {
    const nextPath = extendBogglePath(pathRef.current, nextIndex);
    if (nextPath !== pathRef.current) {
      pathRef.current = nextPath;
      setSelectedPath(nextPath);
    }
  };

  const handlePointerDown = event => {
    const cell = event.target.closest('[data-boggle-cell]');
    if (!cell || !dictionary || submitting || timeLeft === 0 || game.phase !== 'playing') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    pathRef.current = [];
    setSelectedPath([]);
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePath(Number(cell.dataset.boggleCell));
  };

  const handlePointerMove = event => {
    if (pointerIdRef.current !== event.pointerId || !boardRef.current) return;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-boggle-cell]');
    if (!cell || !boardRef.current.contains(cell)) return;
    updatePath(Number(cell.dataset.boggleCell));
  };

  const clearPointerPath = () => {
    pointerIdRef.current = null;
    pathRef.current = [];
    setSelectedPath([]);
  };

  const handlePointerUp = event => {
    if (pointerIdRef.current !== event.pointerId) return;
    const submittedPath = [...pathRef.current];
    const formedWord = submittedPath.map(index => game.board[index]).join('');
    clearPointerPath();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (formedWord) handleSubmit(formedWord, submittedPath);
  };

  const handlePointerCancel = event => {
    if (pointerIdRef.current === event.pointerId) clearPointerPath();
  };

  const handlePlayAgain = async () => {
    if (!isHost || playingAgain) return;
    setPlayingAgain(true);
    try {
      await loadBoggleDictionary();
      await initBoggleGame(
        roomId,
        players,
        room.settings?.minWordLength || 3,
        room.settings?.roundDuration || 120
      );
      setPlayingAgain(false);
    } catch (error) {
      notify(error.message || 'Could not start another round.', 'error');
      setPlayingAgain(false);
    }
  };

  if (!room || !game) return null;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, '0');

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#080c12', color: '#e6edf3', p: { xs: 1.5, sm: 3 } }}>
      <OfflineBanner online={online} />
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
          <Box>
            <Typography sx={{ color: ACCENT, fontWeight: 900, fontSize: { xs: '1.25rem', sm: '1.7rem' } }}>
              🔤 Boggle Party
            </Typography>
            <Typography sx={{ color: '#8b949e', fontSize: '0.8rem' }}>
              Find words by tracing adjacent letters. Use each tile once.
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={requestLeave}
            sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', flexShrink: 0 }}>
            Leave
          </Button>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
          <Chip label={`${minutes}:${seconds}`} sx={{
            fontSize: '1.1rem', fontWeight: 900, color: timeLeft <= 15 ? '#ef4444' : ACCENT,
            bgcolor: 'rgba(255,255,255,0.06)', minWidth: 92,
          }} />
          <Chip label={`Minimum ${game.minWordLength} letters`} sx={{
            color: '#8ab4ff', bgcolor: 'rgba(58,134,255,0.1)', fontWeight: 700,
          }} />
        </Box>

        {dictionaryError && game.phase === 'playing' && (
          <Box sx={{ textAlign: 'center', mb: 1.5 }}>
            <Typography sx={{ color: '#ef4444', fontSize: '0.8rem' }}>
              Dictionary unavailable: {dictionaryError}
            </Typography>
            <Button size="small" onClick={() => {
              setDictionaryError('');
              loadBoggleDictionary().then(setDictionary).catch(error => setDictionaryError(error.message));
            }} sx={{ color: ACCENT }}>Retry</Button>
          </Box>
        )}
        {!dictionary && !dictionaryError && game.phase === 'playing' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <CircularProgress size={14} sx={{ color: ACCENT }} />
            <Typography sx={{ color: '#8b949e', fontSize: '0.78rem' }}>Loading the word list…</Typography>
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 1fr) minmax(260px, 0.8fr)' }, gap: 2 }}>
          <Box>
            <Box ref={boardRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}
              sx={{
              width: 'min(100%, 440px)', mx: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: { xs: 0.8, sm: 1.2 }, p: { xs: 1, sm: 1.5 }, borderRadius: '20px',
              bgcolor: 'rgba(6,214,160,0.07)', border: '1px solid rgba(6,214,160,0.2)',
              touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
              cursor: dictionary && timeLeft > 0 && game.phase === 'playing' ? 'pointer' : 'default',
            }}>
              {(game.board || []).map((letter, index) => (
                <Box key={index} data-boggle-cell={index} sx={{
                  aspectRatio: '1', display: 'grid', placeItems: 'center', borderRadius: { xs: '12px', sm: '16px' },
                  bgcolor: selectedPath.includes(index) || (feedbackPath.includes(index) && wordFeedback?.status === 'correct')
                    ? 'rgba(6,214,160,0.3)'
                    : feedbackPath.includes(index) && wordFeedback?.status === 'wrong'
                      ? 'rgba(239,68,68,0.25)' : '#17212b',
                  border: selectedPath.includes(index) || feedbackPath.includes(index)
                    ? `2px solid ${wordFeedback?.status === 'wrong' ? '#ef4444' : ACCENT}`
                    : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: selectedPath.includes(index) || feedbackPath.includes(index)
                    ? `0 0 16px ${wordFeedback?.status === 'wrong' ? '#ef4444' : ACCENT}55`
                    : '0 4px 12px rgba(0,0,0,0.25)',
                  color: '#f1f5f9', fontSize: { xs: '2rem', sm: '2.8rem' }, fontWeight: 900,
                  textTransform: 'uppercase',
                  transition: 'background-color 0.08s, border-color 0.08s, box-shadow 0.08s',
                }}>
                  {letter}
                </Box>
              ))}
            </Box>

            {game.phase === 'playing' ? (
              <Box sx={{ mt: 1.5, maxWidth: 440, mx: 'auto', textAlign: 'center', minHeight: 48 }}>
                <Typography aria-live="polite" sx={{
                  color: selectedPath.length >= game.minWordLength ? ACCENT : '#8b949e',
                  fontFamily: 'monospace', fontSize: '1.35rem', fontWeight: 900, letterSpacing: '0.12em',
                  minHeight: 28,
                }}>
                  {selectedPath.map(index => game.board[index]).join('').toUpperCase() || 'DRAG ACROSS LETTERS'}
                </Typography>
                <Typography sx={{ color: '#687582', fontSize: '0.72rem' }}>
                  Release to submit{selectedPath.length > 0 ? ' · drag back one tile to undo' : ''}
                  {submitting ? ' · checking word…' : ''}
                </Typography>
                <Box sx={{ minHeight: 32, mt: 0.4 }}>
                  <AnimatePresence mode="wait">
                    {wordFeedback && (
                      <motion.div key={wordFeedback.id}
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={wordFeedback.status === 'wrong'
                          ? { opacity: 1, y: 0, scale: [0.96, 1.04, 1], x: [0, -4, 4, -3, 0] }
                          : { opacity: 1, y: 0, scale: [0.96, 1.08, 1] }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.35 }}>
                        <Typography sx={{
                          color: wordFeedback.status === 'correct' ? ACCENT : '#ef6b6b',
                          fontWeight: 900, fontSize: '0.8rem',
                        }}>
                          {wordFeedback.word.toUpperCase()} · {wordFeedback.message}
                        </Typography>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Box>
                <Typography sx={{ color: '#687582', fontSize: '0.66rem', mt: 0.5 }}>
                  Unique word: 2 points · shared word: 1 point per finder
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mt: 2, p: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
                <Typography sx={{ color: '#ffd166', fontWeight: 900, fontSize: '1.2rem' }}>Round complete!</Typography>
                {isHost && (
                  <Button onClick={handlePlayAgain} disabled={playingAgain} startIcon={<ReplayIcon />}
                    sx={{ mt: 1, color: ACCENT, fontWeight: 800 }}>
                    {playingAgain ? 'Starting…' : 'Play Again'}
                  </Button>
                )}
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 1.5, minHeight: 260 }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Typography sx={{ fontWeight: 900, color: ACCENT, mb: 1 }}>Players</Typography>
              {sortedPlayers.map((uid, index) => (
                <Box key={uid} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                  <Typography sx={{ color: '#8b949e', width: 22 }}>{index + 1}.</Typography>
                  <Avatar sx={{ width: 26, height: 26, bgcolor: room.players?.[uid]?.avatar?.color, fontSize: '0.7rem' }}>
                    {room.players?.[uid]?.name?.[0] || '?'}
                  </Avatar>
                  <Typography sx={{ flex: 1, fontWeight: 700 }}>
                    {uid === userId ? 'You' : room.players?.[uid]?.name || 'Player'}
                  </Typography>
                  <Typography sx={{ color: '#ffd166', fontWeight: 900 }}>
                    {game.phase === 'finished'
                      ? `${game.scores?.[uid] || 0} pts`
                      : `${wordsFoundBy(uid)} words`}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Typography sx={{ fontWeight: 900, color: '#8ab4ff', mb: 1 }}>
                Your words <Typography component="span" sx={{ color: '#8b949e', fontSize: '0.75rem' }}>({myWords.length})</Typography>
              </Typography>
              {myWords.length === 0 ? (
                <Typography sx={{ color: '#687582', fontSize: '0.8rem' }}>Valid words you find will appear here.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
                  {myWords.map(entry => (
                    <Chip key={entry.word} size="small" label={`${entry.word.toUpperCase()}${entry.shared ? ' · shared' : ''}`}
                      sx={{ color: entry.shared ? '#8b949e' : '#e6edf3', bgcolor: entry.shared ? 'rgba(255,255,255,0.05)' : 'rgba(6,214,160,0.12)' }} />
                  ))}
                </Box>
              )}
              {game.phase === 'finished' && (
                <Typography sx={{ color: '#8b949e', fontSize: '0.72rem', mt: 1 }}>
                  Unique words earn 2 points. Words found by multiple players earn 1 point for each finder.
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
      <AnimatePresence>
        {game.phase === 'finished' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center',
              padding: 16, background: 'rgba(4,8,12,0.82)', backdropFilter: 'blur(8px)',
            }}>
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 20 }}
              style={{ width: 'min(100%, 440px)' }}>
              <Box sx={{
                p: { xs: 2.5, sm: 3.5 }, borderRadius: '22px', textAlign: 'center',
                bgcolor: '#111a24', border: '1px solid rgba(6,214,160,0.35)',
                boxShadow: '0 20px 80px rgba(0,0,0,0.5)',
              }}>
                <motion.div initial={{ scale: 0.5, rotate: -12 }}
                  animate={{ scale: [0.5, 1.15, 1], rotate: 0 }}
                  transition={{ duration: 0.55 }}>
                  <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>🏆</Typography>
                </motion.div>
                <Typography sx={{ mt: 1, color: ACCENT, fontSize: '1.5rem', fontWeight: 900 }}>
                  Round complete!
                </Typography>
                <Typography sx={{ mb: 2, color: '#8b949e', fontSize: '0.8rem' }}>
                  Final scores · unique words: 2 pts · shared words: 1 pt per finder
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.8, mb: 2.5 }}>
                  {sortedPlayers.map((uid, index) => (
                    <motion.div key={uid} initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + index * 0.08 }}>
                      <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 1, p: 1,
                        borderRadius: '10px',
                        bgcolor: index === 0 ? 'rgba(6,214,160,0.12)' : 'rgba(255,255,255,0.04)',
                      }}>
                        <Typography sx={{ width: 24, color: index === 0 ? '#ffd166' : '#8b949e', fontWeight: 900 }}>
                          {index + 1}.
                        </Typography>
                        <Typography sx={{ flex: 1, textAlign: 'left', fontWeight: 800 }}>
                          {uid === userId ? 'You' : room.players?.[uid]?.name || 'Player'}
                        </Typography>
                        <Typography sx={{ color: ACCENT, fontWeight: 900 }}>
                          {game.scores?.[uid] || 0} pts
                        </Typography>
                      </Box>
                    </motion.div>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                  {isHost && (
                    <Button onClick={handlePlayAgain} disabled={playingAgain} startIcon={<ReplayIcon />}
                      variant="contained" sx={{ bgcolor: ACCENT, color: '#06261d', fontWeight: 900 }}>
                      {playingAgain ? 'Starting…' : 'Play Again'}
                    </Button>
                  )}
                  <Button onClick={requestLeave} variant="outlined"
                    sx={{ color: '#ef6b6b', borderColor: 'rgba(239,107,107,0.4)' }}>
                    Leave
                  </Button>
                </Box>
              </Box>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <LeaveConfirmModal open={confirmOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </Box>
  );
}

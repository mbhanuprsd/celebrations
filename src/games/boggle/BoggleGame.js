import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';
import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { useGameGuard } from '../../hooks/useGameSession';
import { saveGameHistory } from '../../firebase/services';
import { LeaveConfirmModal, OfflineBanner } from '../../components/GameSharedUI';
import { useBotTurns } from '../bots/useBotTurns';
import {
  loadBoggleDictionary,
  submitBoggleWord,
  finishBoggleRound,
  initBoggleGame,
  startBoggleRound,
} from './boggleFirebaseService';
import './BoggleGame.css';
import {
  extendBogglePath,
  findBoggleWordPath,
  getBoggleCellAtPoint,
  getBoggleCellsAlongSegment,
  findLongestBoggleWords,
  getWordScore,
  isWordOnBoard,
} from './boggleConstants';

const ACCENT = '#06D6A0';
const EMPTY_SUBMISSIONS = Object.freeze({});
const EMPTY_PLAYER_ORDER = Object.freeze([]);

export function BoggleGame() {
  const { state, notify } = useGameContext();
  const reduceMotion = useReducedMotion();
  const { leave } = useRoom();
  const { room, roomId, userId, isHost } = state;
  const notifyRef = useRef(notify);
  const game = room?.boggleState;
  useBotTurns({ room, roomId, isHost, gameType: 'boggle' });
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
  const [countdown, setCountdown] = useState(3);
  const [revealedWordCount, setRevealedWordCount] = useState(0);
  const finishStartedRef = useRef(false);
  const boardRef = useRef(null);
  const pathRef = useRef([]);
  const pointerIdRef = useRef(null);
  const cellCentersRef = useRef([]);
  const boardBoundsRef = useRef(null);
  const lastPointerPositionRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const historySavedForRef = useRef(null);

  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  useEffect(() => () => clearTimeout(feedbackTimerRef.current), []);

  useEffect(() => {
    if (game?.phase === 'playing') {
      historySavedForRef.current = null;
      return;
    }
    if (game?.phase !== 'finished' || !userId || !room) return;
    const gameKey = game.startedAt || game.finishedAt;
    if (!gameKey || historySavedForRef.current === gameKey) return;

    const humanPlayers = (game.playerOrder || []).filter(uid => !room.players?.[uid]?.isBot);
    if (!humanPlayers.includes(userId)) return;

    historySavedForRef.current = gameKey;
    const scores = game.scores || {};
    const allRankedUids = [...(game.playerOrder || [])].sort((a, b) =>
      (scores[b] || 0) - (scores[a] || 0)
    );
    const rankedUids = [...humanPlayers].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
    const botsPlayed = (game.playerOrder || []).filter(uid => room.players?.[uid]?.isBot).length;
    const winnerUid = allRankedUids[0];
    void saveGameHistory(userId, {
      gameType: 'boggle',
      roomId,
      isWinner: winnerUid === userId,
      myRank: rankedUids.indexOf(userId) + 1,
      totalPlayers: humanPlayers.length,
      botsPlayed,
      winnerName: room.players?.[winnerUid]?.name || '',
      rankedPlayers: rankedUids.map((uid, index) => ({
        name: room.players?.[uid]?.name || uid,
        score: scores[uid] || 0,
        rank: index + 1,
        isMe: uid === userId,
      })),
    }).catch(error => console.error('Could not save Boggle game history:', error));
  }, [game, room, roomId, userId]);

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
    if (game?.phase !== 'countdown' || !game.countdownEndsAt) return undefined;
    let starting = false;
    let nextStartAttemptAt = 0;
    let notifiedStartError = false;
    const updateCountdown = () => {
      const remaining = game.countdownEndsAt - Date.now();
      setCountdown(Math.max(1, Math.ceil(remaining / 1000)));
      if (remaining <= 0 && !starting && Date.now() >= nextStartAttemptAt) {
        starting = true;
        nextStartAttemptAt = Date.now() + 1000;
        startBoggleRound(roomId)
          .then(started => {
            if (!started) starting = false;
          })
          .catch(error => {
            starting = false;
            if (!notifiedStartError) {
              notifiedStartError = true;
              notifyRef.current(error.message || 'Could not start the round.', 'error');
            }
          });
      }
    };
    updateCountdown();
    const timerId = setInterval(updateCountdown, 100);
    return () => clearInterval(timerId);
  }, [game?.countdownEndsAt, game?.phase, roomId]);

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

  const submissions = game?.submissions || EMPTY_SUBMISSIONS;
  const myWords = useMemo(() => Object.entries(submissions)
    .filter(([, foundBy]) => foundBy?.[userId])
    .map(([foundWord, foundBy]) => ({ word: foundWord, shared: Object.keys(foundBy).length > 1 }))
    .sort((a, b) => a.word.localeCompare(b.word)), [submissions, userId]);

  const players = game?.playerOrder || EMPTY_PLAYER_ORDER;
  const sortedPlayers = [...players].sort(
    (a, b) => (game?.scores?.[b] || 0) - (game?.scores?.[a] || 0)
  );
  const finalRanks = sortedPlayers.reduce((ranks, uid, index) => {
    const previousUid = sortedPlayers[index - 1];
    const tiedWithPrevious = index > 0 &&
      (game?.scores?.[uid] || 0) === (game?.scores?.[previousUid] || 0);
    ranks[uid] = tiedWithPrevious ? ranks[previousUid] : index + 1;
    return ranks;
  }, {});
  const scoringWords = useMemo(() => Object.entries(submissions)
    .map(([word, foundBy]) => ({
      word,
      finders: players.filter(uid => foundBy?.[uid]),
    }))
    .filter(entry => entry.finders.length > 0)
    .sort((a, b) => a.word.localeCompare(b.word)), [players, submissions]);
  const revealedScores = useMemo(() => {
    const scores = Object.fromEntries(players.map(uid => [uid, 0]));
    scoringWords.slice(0, revealedWordCount).forEach(({ word, finders }) => {
      const points = getWordScore(finders.length, word.length);
      finders.forEach(uid => {
        scores[uid] += points;
      });
    });
    return scores;
  }, [players, scoringWords, revealedWordCount]);
  const maxFinalScore = Math.max(0, ...players.map(uid => game?.scores?.[uid] || 0));
  const resultsComplete = revealedWordCount >= scoringWords.length;
  const activeScoringWord = scoringWords[revealedWordCount - 1];
  const activeScoringPath = useMemo(() => activeScoringWord
    ? findBoggleWordPath(activeScoringWord.word, game?.board)
    : [], [activeScoringWord, game?.board]);
  const scoringPathPositions = useMemo(
    () => new Map(activeScoringPath.map((cellIndex, position) => [cellIndex, position + 1])),
    [activeScoringPath]
  );
  const revealedWords = useMemo(
    () => new Set(scoringWords.slice(0, revealedWordCount).map(({ word }) => word)),
    [scoringWords, revealedWordCount]
  );

  useEffect(() => {
    if (game?.phase !== 'finished') {
      setRevealedWordCount(0);
      return undefined;
    }
    if (reduceMotion || scoringWords.length === 0) {
      setRevealedWordCount(scoringWords.length);
      return undefined;
    }

    setRevealedWordCount(0);
    const timerId = setInterval(() => {
      setRevealedWordCount(count => Math.min(count + 1, scoringWords.length));
    }, 1200);
    return () => clearInterval(timerId);
  }, [game?.phase, game?.startedAt, reduceMotion, scoringWords.length]);

  const wordsByPlayer = useMemo(() => Object.fromEntries(players.map(uid => [
    uid,
    Object.entries(submissions)
      .filter(([, foundBy]) => foundBy?.[uid])
      .map(([word, foundBy]) => ({ word, shared: Object.keys(foundBy).length > 1 }))
      .sort((a, b) => a.word.localeCompare(b.word)),
  ])), [players, submissions]);
  const longestWords = useMemo(() => {
    if (game?.phase !== 'finished' || !dictionary) return [];
    return findLongestBoggleWords(game.board, dictionary, game.minWordLength);
  }, [game?.board, game?.minWordLength, game?.phase, dictionary]);
  const wordsFoundBy = uid => Object.values(submissions)
    .filter(foundBy => foundBy?.[uid]).length;

  const showWordFeedback = (message, status, rawWord, path = []) => {
    clearTimeout(feedbackTimerRef.current);
    setFeedbackPath(path);
    setWordFeedback({ message, status, word: rawWord, id: Date.now() });
    feedbackTimerRef.current = setTimeout(() => {
      setWordFeedback(null);
      setFeedbackPath([]);
    }, 800);
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
        const uniquePoints = getWordScore(1, normalized.length);
        const sharedPoints = getWordScore(2, normalized.length);
        showWordFeedback(
          `Valid · ${normalized.length} letters · unique +${uniquePoints} pts / shared +${sharedPoints} pt${sharedPoints === 1 ? '' : 's'}`,
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

  const refreshCellGeometry = board => {
    const bounds = board.getBoundingClientRect();
    boardBoundsRef.current = bounds;
    cellCentersRef.current = [...board.querySelectorAll('[data-boggle-cell]')].map(cell => {
      const rect = cell.getBoundingClientRect();
      return {
        index: Number(cell.dataset.boggleCell),
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      };
    });
  };

  const handlePointerDown = event => {
    const cell = event.target.closest('[data-boggle-cell]');
    if (!cell || !dictionary || submitting || timeLeft === 0 || game.phase !== 'playing') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    refreshCellGeometry(event.currentTarget);
    const startingCell = getBoggleCellAtPoint(
      cellCentersRef.current,
      event.clientX,
      event.clientY
    );
    if (startingCell == null) return;

    pointerIdRef.current = event.pointerId;
    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    pathRef.current = [];
    setSelectedPath([]);
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePath(startingCell);
  };

  const handlePointerMove = event => {
    if (pointerIdRef.current !== event.pointerId) return;
    let previousPosition = lastPointerPositionRef.current;
    const nativeEvent = event.nativeEvent;
    const pointerEvents = typeof nativeEvent.getCoalescedEvents === 'function'
      ? nativeEvent.getCoalescedEvents()
      : [nativeEvent];
    const samples = [...pointerEvents];
    const lastSample = samples[samples.length - 1];
    if (!lastSample || lastSample.clientX !== nativeEvent.clientX ||
        lastSample.clientY !== nativeEvent.clientY) {
      samples.push(nativeEvent);
    }

    samples.forEach(pointerEvent => {
      const nextPosition = { x: pointerEvent.clientX, y: pointerEvent.clientY };
      if (previousPosition) {
        getBoggleCellsAlongSegment(
          cellCentersRef.current,
          previousPosition,
          nextPosition,
          boardBoundsRef.current
        ).forEach(updatePath);
      }
      previousPosition = nextPosition;
      lastPointerPositionRef.current = nextPosition;
    });
  };

  const clearPointerPath = () => {
    pointerIdRef.current = null;
    lastPointerPositionRef.current = null;
    pathRef.current = [];
    setSelectedPath([]);
  };

  const handlePointerUp = event => {
    if (pointerIdRef.current !== event.pointerId) return;
    handlePointerMove(event);
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
    <Box sx={{
      height: '100dvh', overflowY: 'auto', boxSizing: 'border-box',
      position: 'relative', bgcolor: '#080c12', color: '#e6edf3', p: { xs: 1.5, sm: 3 },
    }}>
      {game.phase === 'finished' && (
        <Box className="boggle-fireworks" aria-hidden="true">
          {[
            { left: '13%', top: '32%', delay: '0s' },
            { left: '83%', top: '24%', delay: '-1s' },
            { left: '76%', top: '74%', delay: '-2s' },
          ].map((burst, burstIndex) => (
            <Box key={burstIndex} className="boggle-firework-burst" sx={burst}>
              {Array.from({ length: 14 }, (_, index) => (
                <span
                  key={index}
                  className="boggle-firework-spark"
                  style={{
                    '--spark-angle': `${(360 / 14) * index}deg`,
                    '--spark-distance': `${38 + (index % 3) * 10}px`,
                    '--spark-delay': `${(index % 4) * 35}ms`,
                  }}
                />
              ))}
            </Box>
          ))}
        </Box>
      )}
      <OfflineBanner online={online} />
      <Box sx={{ maxWidth: 960, mx: 'auto', position: 'relative', zIndex: 1 }}>
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
          {game.phase === 'playing' && (
            <motion.div
              animate={!reduceMotion && timeLeft <= 10 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.8, repeat: !reduceMotion && timeLeft <= 10 ? Infinity : 0 }}
            >
              <Chip label={`${minutes}:${seconds}`} sx={{
                fontSize: '1.1rem', fontWeight: 900, color: timeLeft <= 15 ? '#ef4444' : ACCENT,
                bgcolor: 'rgba(255,255,255,0.06)', minWidth: 92,
              }} />
            </motion.div>
          )}
          <Chip label={`Minimum ${game.minWordLength} letters`} sx={{
            color: '#8ab4ff', bgcolor: 'rgba(58,134,255,0.1)', fontWeight: 700,
          }} />
        </Box>

        {game.phase === 'finished' && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3 }}
          >
            <Box sx={{
              mb: 2, p: { xs: 1.5, sm: 2 }, borderRadius: 2,
              bgcolor: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.3)',
            }}>
              <Typography sx={{ color: ACCENT, fontSize: '1.1rem', fontWeight: 900, mb: 1 }}>
                Round results
              </Typography>
              {scoringWords.length > 0 && (
                <Box sx={{
                  mb: 1.25, p: 1.25, borderRadius: 1.5,
                  bgcolor: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.8 }}>
                    <Typography sx={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Word-by-word scoring
                    </Typography>
                    <Typography aria-live="polite" sx={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 700 }}>
                      {revealedWordCount} / {scoringWords.length}
                    </Typography>
                  </Box>
                  <Box sx={{
                    height: 4, mb: 1, overflow: 'hidden', borderRadius: 4,
                    bgcolor: 'rgba(255,255,255,0.08)',
                  }}>
                    <motion.div
                      initial={false}
                      animate={{ width: `${(revealedWordCount / scoringWords.length) * 100}%` }}
                      transition={{ duration: reduceMotion ? 0 : 0.25 }}
                      style={{ height: '100%', background: ACCENT }}
                    />
                  </Box>
                  <Box sx={{ minHeight: 55 }}>
                    <AnimatePresence mode="wait" initial={false}>
                      {activeScoringWord ? (
                        <motion.div
                          key={activeScoringWord.word}
                          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                          transition={{ duration: reduceMotion ? 0 : 0.22 }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.08em' }}>
                              {activeScoringWord.word.toUpperCase()}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${getWordScore(activeScoringWord.finders.length, activeScoringWord.word.length)} pt${getWordScore(activeScoringWord.finders.length, activeScoringWord.word.length) === 1 ? '' : 's'} each`}
                              sx={{ color: '#ffd166', bgcolor: 'rgba(255,209,102,0.1)', fontWeight: 800 }}
                            />
                          </Box>
                          <Typography sx={{ color: '#8b949e', fontSize: '0.72rem', mt: 0.3 }}>
                            Found by {activeScoringWord.finders.map(uid =>
                              uid === userId ? 'You' : room.players?.[uid]?.name || 'Player'
                            ).join(', ')}
                          </Typography>
                        </motion.div>
                      ) : (
                        <Typography sx={{ color: '#8b949e', fontSize: '0.78rem', py: 1 }}>
                          {revealedWordCount >= scoringWords.length ? 'All words scored' : 'Preparing word scores…'}
                        </Typography>
                      )}
                    </AnimatePresence>
                  </Box>
                  {revealedWordCount < scoringWords.length && (
                    <Button size="small" onClick={() => setRevealedWordCount(scoringWords.length)}
                      sx={{ mt: 0.4, p: 0, minWidth: 0, color: ACCENT, fontSize: '0.7rem', fontWeight: 800 }}>
                      Show final scores
                    </Button>
                  )}
                </Box>
              )}
              <Box
                role="img"
                aria-label={`Final scores column chart for ${players.length} players`}
                sx={{ overflowX: 'auto', px: 0.5, pb: 0.5 }}
              >
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.max(players.length, 1)}, minmax(44px, 1fr))`,
                  minWidth: Math.max(100, players.length * 58),
                  minHeight: { xs: 150, sm: 250 },
                  borderBottom: '1px solid rgba(255,255,255,0.15)',
                }}>
                  {(resultsComplete ? sortedPlayers : players).map((uid, index) => {
                    const score = revealedScores[uid] || 0;
                    const barHeight = maxFinalScore > 0 ? (score / maxFinalScore) * 100 : 0;
                    const playerName = uid === userId ? 'You' : room.players?.[uid]?.name || 'Player';
                    const rank = finalRanks[uid];
                    const barColor = resultsComplete && rank === 1
                      ? '#ffd166'
                      : uid === userId ? ACCENT : '#4cc9f0';
                    const placeLabel = ['1st', '2nd', '3rd'][rank - 1] || `#${rank}`;
                    return (
                      <Box key={uid} sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'flex-end', minWidth: 0, px: 0.6,
                      }}>
                        {resultsComplete && (
                          <Chip
                            size="small"
                            label={placeLabel}
                            sx={{
                              height: { xs: 16, sm: 20 }, mb: 0.35,
                              fontSize: { xs: '0.52rem', sm: '0.62rem' }, fontWeight: 900,
                              color: rank === 1 ? '#ffd166' : rank <= 3 ? '#e6edf3' : '#8b949e',
                              bgcolor: rank === 1 ? 'rgba(255,209,102,0.14)' : 'rgba(255,255,255,0.06)',
                              border: rank === 1 ? '1px solid rgba(255,209,102,0.35)' : '1px solid rgba(255,255,255,0.08)',
                            }}
                          />
                        )}
                        <Typography sx={{
                          color: '#e6edf3', fontSize: '0.68rem', fontWeight: 900, mb: 0.45,
                        }}>
                          {score}
                        </Typography>
                        <Box sx={{
                          height: { xs: 72, sm: 145 }, width: '100%', display: 'flex', alignItems: 'flex-end',
                          justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)',
                          background: 'repeating-linear-gradient(to top, transparent 0, transparent 35px, rgba(255,255,255,0.045) 36px)',
                        }}>
                          <motion.div
                            initial={false}
                            animate={{ height: `${barHeight}%` }}
                            transition={reduceMotion ? { duration: 0 } : {
                              type: 'spring', stiffness: 180, damping: 24,
                            }}
                            style={{
                              width: 'min(70%, 34px)', minHeight: score > 0 ? 4 : 0,
                              borderRadius: '6px 6px 0 0',
                              background: `linear-gradient(180deg, ${barColor}, ${barColor}88)`,
                              boxShadow: score > 0 ? `0 0 14px ${barColor}44` : 'none',
                            }}
                          />
                        </Box>
                        <Typography sx={{
                          width: '100%', mt: 0.65, color: uid === userId ? ACCENT : '#8b949e',
                          fontSize: '0.66rem', fontWeight: uid === userId ? 900 : 700,
                          textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {playerName}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          </motion.div>
        )}

        {dictionaryError && game.phase === 'playing' && (
          <Box sx={{ textAlign: 'center', mb: 1.5 }}>
            <Typography sx={{ color: '#ef4444', fontSize: '0.8rem' }}>
              Dictionary unavailable: {dictionaryError}
            </Typography>
            <Button size="small" onClick={() => {
              setDictionaryError('');
              loadBoggleDictionary().then(words => {
                setDictionary(words);
                setDictionaryError('');
              }).catch(error => setDictionaryError(error.message || 'Could not load the word list.'));
            }} sx={{ color: ACCENT }}>Retry</Button>
          </Box>
        )}
        {!dictionary && !dictionaryError && game.phase === 'playing' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <CircularProgress size={14} sx={{ color: ACCENT }} />
            <Typography sx={{ color: '#8b949e', fontSize: '0.78rem' }}>Loading the word list…</Typography>
          </Box>
        )}

        {game.phase === 'countdown' ? (
          <Box sx={{
            minHeight: '55vh', display: 'grid', placeItems: 'center', textAlign: 'center',
          }}>
            <Box>
              <Typography sx={{
                color: ACCENT, fontSize: { xs: '1.1rem', sm: '1.35rem' },
                fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                Get ready
              </Typography>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={countdown}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.65, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.25, y: -12 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                  <Typography aria-live="assertive" sx={{
                    color: '#f1f5f9', fontSize: { xs: '6rem', sm: '8rem' },
                    fontWeight: 900, lineHeight: 1.1,
                    textShadow: '0 0 36px rgba(6,214,160,0.45)',
                  }}>
                    {countdown}
                  </Typography>
                </motion.div>
              </AnimatePresence>
              <Typography sx={{ color: '#8b949e', fontSize: '0.9rem', mt: 1 }}>
                The board is coming up…
              </Typography>
            </Box>
          </Box>
        ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 1fr) minmax(260px, 0.8fr)' }, gap: 2 }}>
          <Box>
            <Box ref={boardRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel}
              sx={{
              width: 'min(100%, 440px)', mx: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: { xs: 0.5, sm: 0.8 }, p: { xs: 0.8, sm: 1.2 }, borderRadius: '20px',
              bgcolor: 'rgba(6,214,160,0.07)', border: '1px solid rgba(6,214,160,0.2)',
              touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
              cursor: dictionary && timeLeft > 0 && game.phase === 'playing' ? 'pointer' : 'default',
            }}>
              {(game.board || []).map((letter, index) => (
                <motion.div
                  key={`${game.startedAt}-${index}`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduceMotion ? { duration: 0 } : {
                    duration: 0.18, delay: index * 0.025,
                  }}
                >
                <Box data-boggle-cell={index} sx={{
                  aspectRatio: '1', display: 'grid', placeItems: 'center', borderRadius: { xs: '12px', sm: '16px' },
                  position: 'relative',
                  bgcolor: scoringPathPositions.has(index)
                    ? 'rgba(255,209,102,0.3)'
                    : selectedPath.includes(index) || (feedbackPath.includes(index) && wordFeedback?.status === 'correct')
                    ? 'rgba(6,214,160,0.3)'
                    : feedbackPath.includes(index) && wordFeedback?.status === 'wrong'
                      ? 'rgba(239,68,68,0.25)' : '#17212b',
                  border: scoringPathPositions.has(index)
                    ? '2px solid #ffd166'
                    : selectedPath.includes(index) || feedbackPath.includes(index)
                    ? `2px solid ${wordFeedback?.status === 'wrong' ? '#ef4444' : ACCENT}`
                    : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: scoringPathPositions.has(index)
                    ? '0 0 20px rgba(255,209,102,0.65)'
                    : selectedPath.includes(index) || feedbackPath.includes(index)
                    ? `0 0 16px ${wordFeedback?.status === 'wrong' ? '#ef4444' : ACCENT}55`
                    : '0 4px 12px rgba(0,0,0,0.25)',
                  color: scoringPathPositions.has(index) ? '#fff4ce' : '#f1f5f9',
                  fontSize: { xs: '2rem', sm: '2.8rem' }, fontWeight: 900,
                  textTransform: 'uppercase',
                  transition: 'background-color 0.18s, border-color 0.18s, box-shadow 0.18s, color 0.18s',
                }}>
                  <motion.span
                    style={{ display: 'inline-block' }}
                    initial={reduceMotion ? false : { scale: 0.65 }}
                    animate={{ scale: scoringPathPositions.has(index) ? 1.12 : selectedPath.includes(index) ? 1.12 : 1 }}
                    transition={reduceMotion ? { duration: 0 } : {
                      type: 'spring', stiffness: 500, damping: 18, delay: index * 0.025,
                    }}
                  >
                    {letter}
                  </motion.span>
                  <AnimatePresence>
                    {scoringPathPositions.has(index) && (
                      <motion.span
                        key={`${activeScoringWord?.word}-${index}`}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.18 }}
                        style={{
                          position: 'absolute', top: 4, right: 6, minWidth: 18,
                          height: 18, borderRadius: 9, display: 'grid', placeItems: 'center',
                          background: '#ffd166', color: '#302308', fontSize: 10,
                          fontWeight: 900, lineHeight: 1, pointerEvents: 'none',
                        }}
                      >
                        {scoringPathPositions.get(index)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Box>
                </motion.div>
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
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
                        animate={wordFeedback.status === 'wrong'
                          ? reduceMotion
                            ? { opacity: 1 }
                            : { opacity: 1, y: 0, scale: [0.96, 1.04, 1], x: [0, -4, 4, -3, 0] }
                          : reduceMotion
                            ? { opacity: 1 }
                            : { opacity: 1, y: 0, scale: [0.96, 1.08, 1] }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        transition={{ duration: reduceMotion ? 0 : 0.24 }}>
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
                  Longer words score more · unique words earn double
                </Typography>
              </Box>
            ) : (
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 22 }}
              >
              <Box sx={{
                position: 'sticky', bottom: 0, zIndex: 2, mt: 1.5, p: 1.5,
                textAlign: 'center', bgcolor: '#111a24',
                border: '1px solid rgba(6,214,160,0.3)', borderRadius: 2,
                boxShadow: '0 -8px 24px rgba(8,12,18,0.8)',
              }}>
                <Typography sx={{ color: '#ffd166', fontWeight: 900, fontSize: '1.1rem' }}>
                  Round complete!
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                  <Button onClick={handlePlayAgain} disabled={!isHost || playingAgain}
                    startIcon={<ReplayIcon />} variant="contained" sx={{
                      bgcolor: isHost ? ACCENT : 'rgba(255,255,255,0.12)',
                      color: isHost ? '#06261d' : '#8b949e', fontWeight: 900,
                    }}>
                    {playingAgain ? 'Starting…' : isHost ? 'Play Again' : 'Waiting for host'}
                  </Button>
                  <Button onClick={requestLeave} variant="outlined"
                    sx={{ color: '#ef6b6b', borderColor: 'rgba(239,107,107,0.4)' }}>
                    Leave
                  </Button>
                </Box>
              </Box>
              </motion.div>
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 1.5, minHeight: 260 }}>
            {game.phase === 'finished' && (
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.35 }}
              >
              <Box sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: 'rgba(255,209,102,0.07)',
                border: '1px solid rgba(255,209,102,0.22)',
              }}>
                <Typography sx={{ fontWeight: 900, color: '#ffd166', mb: 0.8 }}>
                  Longest possible word
                </Typography>
                {!dictionary ? (
                  <Typography sx={{ color: '#8b949e', fontSize: '0.8rem' }}>
                    Word list unavailable.
                  </Typography>
                ) : longestWords.length === 0 ? (
                  <Typography sx={{ color: '#8b949e', fontSize: '0.8rem' }}>
                    No dictionary words found on this board.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, alignItems: 'center' }}>
                    {longestWords.map(word => (
                      <Chip key={word} size="small" label={word.toUpperCase()}
                        sx={{ color: '#ffd166', bgcolor: 'rgba(255,209,102,0.12)', fontWeight: 900 }} />
                    ))}
                    <Typography sx={{ color: '#8b949e', fontSize: '0.72rem' }}>
                      {longestWords[0].length} letters
                    </Typography>
                  </Box>
                )}
              </Box>
              </motion.div>
            )}
            {game.phase === 'playing' && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.08 }}
              >
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Typography sx={{ fontWeight: 900, color: ACCENT, mb: 1 }}>Players</Typography>
                  {sortedPlayers.map((uid, index) => (
                    <motion.div
                      key={uid}
                      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay: index * 0.04 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <Typography sx={{ color: '#8b949e', width: 22 }}>{index + 1}.</Typography>
                        <Avatar sx={{ width: 26, height: 26, bgcolor: room.players?.[uid]?.avatar?.color, fontSize: '0.7rem' }}>
                          {room.players?.[uid]?.name?.[0] || '?'}
                        </Avatar>
                        <Typography sx={{ flex: 1, fontWeight: 700 }}>
                          {uid === userId ? 'You' : room.players?.[uid]?.name || 'Player'}
                        </Typography>
                        <Typography sx={{ color: '#ffd166', fontWeight: 900 }}>
                          {wordsFoundBy(uid)} words
                        </Typography>
                      </Box>
                    </motion.div>
                  ))}
                </Box>
              </motion.div>
            )}

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.14 }}
            >
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Typography sx={{ fontWeight: 900, color: '#8ab4ff', mb: 1 }}>
                {game.phase === 'finished' ? 'Words by player' : 'Your words'}
              </Typography>
              {game.phase === 'playing' && (myWords.length === 0 ? (
                <Typography sx={{ color: '#687582', fontSize: '0.8rem' }}>
                  Valid words you find will appear here.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
                <AnimatePresence initial={false}>
                  {myWords.map((entry, index) => (
                    <motion.div
                      key={entry.word}
                      layout={!reduceMotion}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 24, delay: index * 0.025 }}
                    >
                      <Chip size="small" label={`${entry.word.toUpperCase()}${entry.shared ? ' · shared' : ''}`}
                        sx={{ color: entry.shared ? '#8b949e' : '#e6edf3', bgcolor: entry.shared ? 'rgba(255,255,255,0.05)' : 'rgba(6,214,160,0.12)' }} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                </Box>
              ))}
              {game.phase === 'finished' && (
                <>
                  {!resultsComplete && (
                    <Typography sx={{ color: '#8b949e', fontSize: '0.75rem', mb: 0.8 }}>
                      Words appear here as they’re scored…
                    </Typography>
                  )}
                  <Box sx={{ display: 'grid', gap: 1, maxHeight: 300, overflowY: 'auto' }}>
                    {(resultsComplete ? sortedPlayers : players).map((uid, index) => (
                      <motion.div
                        key={uid}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay: index * 0.04 }}
                      >
                      <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.6 }}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 800 }}>
                            {uid === userId ? 'You' : room.players?.[uid]?.name || 'Player'}
                          </Typography>
                          <Typography sx={{ color: '#ffd166', fontSize: '0.75rem', fontWeight: 900 }}>
                            {revealedScores[uid] || 0} pts
                          </Typography>
                        </Box>
                        {wordsByPlayer[uid].filter(({ word }) => revealedWords.has(word)).length === 0 ? (
                          <Typography sx={{ color: '#687582', fontSize: '0.75rem' }}>
                            {wordsByPlayer[uid].length === 0 || resultsComplete
                              ? 'No words found'
                              : 'Waiting for words…'}
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                            <AnimatePresence initial={false}>
                              {wordsByPlayer[uid]
                                .filter(({ word }) => revealedWords.has(word))
                                .map(({ word, shared }) => (
                                  <motion.div
                                    key={word}
                                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 6 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={reduceMotion ? { duration: 0 } : {
                                      type: 'spring', stiffness: 420, damping: 24,
                                    }}
                                  >
                                    <Chip size="small"
                                      label={`${word.toUpperCase()}${shared ? ' · shared' : ''}`}
                                      sx={{
                                        height: 24, fontSize: '0.68rem',
                                        color: shared ? '#8b949e' : '#e6edf3',
                                        bgcolor: shared ? 'rgba(255,255,255,0.06)' : 'rgba(6,214,160,0.12)',
                                      }}
                                    />
                                  </motion.div>
                                ))}
                            </AnimatePresence>
                          </Box>
                        )}
                      </Box>
                      </motion.div>
                    ))}
                  </Box>
                  <Typography sx={{ color: '#8b949e', fontSize: '0.72rem', mt: 1 }}>
                    Longer words earn more points. Unique words earn double points.
                  </Typography>
                </>
              )}
            </Box>
            </motion.div>
          </Box>
        </Box>
        )}
      </Box>
      <LeaveConfirmModal open={confirmOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </Box>
  );
}

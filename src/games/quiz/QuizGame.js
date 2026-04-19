// src/games/quiz/QuizGame.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Typography, Button, Avatar, Chip, LinearProgress, CircularProgress,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { useGameGuard } from '../../hooks/useGameSession';
import { OfflineBanner, LeaveConfirmModal } from '../../components/GameSharedUI';
import {
  submitQuizAnswer, revealQuizAnswer, advanceQuizQuestion, resetQuizGame,
} from './quizFirebaseService';
import { generateQuizQuestions } from './quizGeminiService';
import {
  OPTION_LABELS, OPTION_COLORS, QUIZ_SETTINGS, TOPIC_MAP,
} from './quizConstants';

// ─── Winner overlay ──────────────────────────────────────────────────────
function WinnerOverlay({ q, room, isHost, onReset, onLeave, resetting }) {
  const sorted = [...(q.playerOrder || [])].sort(
    (a, b) => (q.scores[b] || 0) - (q.scores[a] || 0)
  );
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
        <Box sx={{ bgcolor: '#0e1520', border: '1px solid rgba(255,215,0,0.3)',
          borderRadius: '20px', p: { xs: 3, sm: 4 }, textAlign: 'center',
          maxWidth: 380, width: '90vw', boxShadow: '0 0 70px rgba(255,215,0,0.18)' }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Typography sx={{ fontSize: '3rem' }}>🏆</Typography>
          </motion.div>
          <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#ffd700', mb: 0.5 }}>
            Quiz Over!
          </Typography>
          <Typography sx={{ color: '#8b949e', fontSize: '0.78rem', mb: 2 }}>
            🧠 {q.topic}
          </Typography>
          <Box mb={3}>
            {sorted.map((uid, i) => (
              <Box key={uid} display="flex" alignItems="center" gap={1.5}
                sx={{ mb: 1, p: 1, borderRadius: '10px',
                  bgcolor: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)' }}>
                <Typography sx={{ fontSize: '1.3rem', width: 28 }}>{medals[i] || `${i + 1}.`}</Typography>
                <Avatar sx={{ bgcolor: OPTION_COLORS[i % 4], width: 30, height: 30,
                  fontSize: '0.85rem', fontWeight: 900 }}>
                  {(room.players?.[uid]?.name || '?').charAt(0).toUpperCase()}
                </Avatar>
                <Typography sx={{ fontWeight: 800, flex: 1, textAlign: 'left',
                  color: i === 0 ? '#ffd700' : '#e6edf3', fontSize: '0.95rem' }}>
                  {room.players?.[uid]?.name || uid}
                </Typography>
                <Chip label={`${q.scores[uid] || 0} pts`} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#e6edf3', fontSize: '0.7rem' }} />
              </Box>
            ))}
          </Box>
          <Box display="flex" gap={1} justifyContent="center">
            {isHost && (
              <Button variant="contained" startIcon={resetting
                ? <CircularProgress size={14} color="inherit" /> : <ReplayIcon />}
                onClick={onReset} disabled={resetting}
                sx={{ background: 'linear-gradient(135deg,#06D6A0,#118AB2)',
                  fontWeight: 900, borderRadius: '12px', px: 3 }}>
                {resetting ? 'Generating…' : 'Play Again'}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={onLeave}
              sx={{ fontWeight: 900, borderRadius: '12px', px: 3,
                borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444',
                '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
              Leave
            </Button>
          </Box>
        </Box>
      </motion.div>
    </motion.div>
  );
}

// ─── Score sidebar ───────────────────────────────────────────────────────
function Scoreboard({ q, room }) {
  const sorted = [...(q.playerOrder || [])].sort(
    (a, b) => (q.scores[b] || 0) - (q.scores[a] || 0)
  );
  return (
    <Box sx={{ bgcolor: 'rgba(0,0,0,0.45)', borderRadius: 2, p: 1.5,
      border: '1px solid rgba(255,255,255,0.07)', minWidth: 160 }}>
      <Typography sx={{ color: '#ffd700', fontWeight: 900, fontSize: '0.75rem', mb: 1 }}>
        🏅 Scores
      </Typography>
      {sorted.map((uid, i) => (
        <Box key={uid} display="flex" alignItems="center" gap={1} mb={0.5}>
          <Typography sx={{ color: '#8b949e', fontSize: '0.65rem', width: 14 }}>
            {i + 1}.
          </Typography>
          <Avatar sx={{ bgcolor: OPTION_COLORS[i % 4], width: 20, height: 20, fontSize: '0.6rem' }}>
            {(room.players?.[uid]?.name || '?').charAt(0).toUpperCase()}
          </Avatar>
          <Typography sx={{ color: '#e6edf3', fontSize: '0.72rem', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {room.players?.[uid]?.name || uid}
          </Typography>
          <Typography sx={{ color: '#ffd700', fontSize: '0.72rem', fontWeight: 900 }}>
            {q.scores[uid] || 0}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Option button ───────────────────────────────────────────────────────
function OptionButton({ label, text, index, phase, myAnswer, correctIndex, allAnswers,
  playerCount, disabled, onClick }) {
  const isSelected   = myAnswer?.optionIndex === index;
  const isCorrect    = index === correctIndex;
  const isWrong      = isSelected && !isCorrect;
  const voteCount    = Object.values(allAnswers || {})
    .filter(a => a.optionIndex === index).length;
  const votePct      = playerCount > 0 ? (voteCount / playerCount) * 100 : 0;

  let bg = 'rgba(255,255,255,0.05)';
  let border = 'rgba(255,255,255,0.1)';
  let textColor = '#e6edf3';

  if (phase === 'reveal') {
    if (isCorrect)    { bg = 'rgba(6,214,160,0.2)';   border = '#06D6A0'; textColor = '#06D6A0'; }
    else if (isWrong) { bg = 'rgba(239,68,68,0.2)';   border = '#ef4444'; textColor = '#ef4444'; }
  } else if (isSelected) {
    bg = `${OPTION_COLORS[index]}22`;
    border = OPTION_COLORS[index];
    textColor = OPTION_COLORS[index];
  }

  return (
    <motion.div whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}>
      <Box onClick={!disabled ? onClick : undefined}
        sx={{ position: 'relative', p: 1.5, borderRadius: '12px', cursor: disabled ? 'default' : 'pointer',
          border: `2px solid ${border}`, bgcolor: bg, transition: 'all 0.2s',
          overflow: 'hidden', mb: 1.5 }}>

        {/* Vote bar (shown during reveal) */}
        {phase === 'reveal' && voteCount > 0 && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: isCorrect
            ? 'rgba(6,214,160,0.1)' : 'rgba(255,255,255,0.04)',
            width: `${votePct}%`, transition: 'width 0.6s ease', zIndex: 0 }} />
        )}

        <Box display="flex" alignItems="center" gap={1.5} sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: `${OPTION_COLORS[index]}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography sx={{ color: OPTION_COLORS[index], fontWeight: 900, fontSize: '0.8rem' }}>
              {label}
            </Typography>
          </Box>
          <Typography sx={{ color: textColor, fontWeight: isSelected || (phase === 'reveal' && isCorrect) ? 700 : 400,
            fontSize: { xs: '0.82rem', sm: '0.9rem' }, flex: 1 }}>
            {text}
          </Typography>
          {phase === 'reveal' && isCorrect && (
            <CheckCircleIcon sx={{ color: '#06D6A0', fontSize: 18, flexShrink: 0 }} />
          )}
          {phase === 'reveal' && isWrong && (
            <CancelIcon sx={{ color: '#ef4444', fontSize: 18, flexShrink: 0 }} />
          )}
          {phase === 'reveal' && voteCount > 0 && (
            <Typography sx={{ color: '#8b949e', fontSize: '0.65rem', flexShrink: 0 }}>
              {voteCount}
            </Typography>
          )}
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────
export function QuizGame() {
  const { state } = useGameContext();
  const { leave } = useRoom();
  const { room, userId, roomId, isHost } = state;
  const q = room?.quizState;

  const { online, confirmOpen, requestLeave, cancelLeave, confirmLeave } = useGameGuard({
    roomId, userId, gameType: 'quiz', leaveCallback: leave,
  });

  const [timeLeft, setTimeLeft] = useState(QUIZ_SETTINGS.answerTime);
  const [resetting, setResetting] = useState(false);
  const timerRef  = useRef(null);
  const revealRef = useRef(null);  // prevent double-fire on reveal/advance

  // ── Countdown timer ───────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!q || q.phase !== 'question') return;

    const start = q.questionStartTime;
    const total = QUIZ_SETTINGS.answerTime;

    // Immediately reset to prevent stale time from previous question flashing
    setTimeLeft(total);

    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, total - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 250);
    return () => clearInterval(timerRef.current);
  }, [q?.currentIndex, q?.phase, q?.questionStartTime]);

  // ── Host auto-advance logic ───────────────────────────────────────────
  // Use a ref for q so checkAdvance always reads the latest without being
  // recreated on every answer (which was resetting revealRef mid-question).
  const qRef = useRef(q);
  useEffect(() => { qRef.current = q; }, [q]);

  const checkAdvance = useCallback(async () => {
    const cur = qRef.current;
    if (!isHost || !cur || cur.phase !== 'question') return;
    const allAnswered = (cur.playerOrder || []).every(uid => cur.answers?.[uid]);
    const timedOut = (Date.now() - cur.questionStartTime) / 1000 >= QUIZ_SETTINGS.answerTime;
    if ((allAnswered || timedOut) && !revealRef.current) {
      revealRef.current = true;
      await revealQuizAnswer(roomId);
    }
  }, [isHost, roomId]);  // stable — no longer depends on q directly

  // Reset revealRef only when the question index changes (not on every answer)
  useEffect(() => {
    revealRef.current = false;
  }, [q?.currentIndex]);

  // Poll for all-answered / time-out (host only)
  useEffect(() => {
    if (!isHost || !q || q.phase !== 'question') return;
    const id = setInterval(checkAdvance, 500);
    return () => clearInterval(id);
  }, [q?.currentIndex, q?.phase, isHost, checkAdvance]);

  // Auto-advance from reveal after revealTime (host only)
  useEffect(() => {
    if (!isHost || !q || q.phase !== 'reveal') return;
    const id = setTimeout(() => {
      advanceQuizQuestion(roomId).catch(console.error);
    }, QUIZ_SETTINGS.revealTime * 1000);
    return () => clearTimeout(id);
  }, [q?.currentIndex, q?.phase, isHost, roomId]);

  // ── Answer handler ────────────────────────────────────────────────────
  const handleAnswer = useCallback(async (idx) => {
    if (!q || q.phase !== 'question' || q.answers?.[userId]) return;
    await submitQuizAnswer(roomId, userId, idx).catch(console.error);
  }, [q, roomId, userId]);

  // ── Play Again ────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      const questions = await generateQuizQuestions(
        q.topic, QUIZ_SETTINGS.questionCount, apiKey
      );
      await resetQuizGame(roomId, q.playerOrder, questions, q.topic);
    } catch (e) {
      console.error('Reset failed', e);
    } finally {
      setResetting(false);
    }
  };

  if (!room || !q || !q.playerOrder) return null;

  const currentQ   = q.questions?.[q.currentIndex];
  const myAnswer   = q.answers?.[userId];
  // topic is now a plain label string (e.g. "Indian History"), find matching preset for icon/color
  const topicPreset = Object.values(TOPIC_MAP).find(
    t => t.label.toLowerCase() === (q.topic || '').toLowerCase()
  );
  const topicIcon  = topicPreset?.icon  || '🧠';
  const topicColor = topicPreset?.color || '#4CC9F0';
  const timePct    = (timeLeft / QUIZ_SETTINGS.answerTime) * 100;
  const answered   = Object.keys(q.answers || {}).length;
  const total      = q.playerOrder.length;
  const qNum       = (q.currentIndex || 0) + 1;
  const qTotal     = q.questions?.length || QUIZ_SETTINGS.questionCount;

  return (
    <Box sx={{ height: '100dvh', bgcolor: '#080c12', display: 'flex',
      flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, bgcolor: 'rgba(0,0,0,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, gap: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: '1.2rem' }}>{topicIcon}</Typography>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '0.9rem' }}>
            {q.topic}
          </Typography>
        </Box>
        {q.phase !== 'finished' && (
          <Chip label={`Q ${qNum} / ${qTotal}`} size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#8b949e',
              fontWeight: 800, fontSize: '0.72rem' }} />
        )}
        <Chip label={`${answered}/${total} answered`} size="small"
          sx={{ bgcolor: answered === total ? 'rgba(6,214,160,0.2)' : 'rgba(255,255,255,0.06)',
            color: answered === total ? '#06D6A0' : '#8b949e',
            fontWeight: 700, fontSize: '0.7rem' }} />
      </Box>

      {/* ── Timer bar ── */}
      {q.phase === 'question' && (
        <LinearProgress variant="determinate" value={timePct}
          sx={{ height: 4, flexShrink: 0,
            bgcolor: 'rgba(255,255,255,0.06)',
            '& .MuiLinearProgress-bar': {
              background: timePct > 50 ? '#06D6A0' : timePct > 25 ? '#FFB703' : '#ef4444',
              transition: 'background 0.5s',
            } }} />
      )}

      {/* ── Main area ── */}
      <Box sx={{ flex: 1, display: 'flex', gap: 2, px: { xs: 1.5, sm: 2 },
        py: 2, overflow: 'hidden', alignItems: 'flex-start' }}>

        {/* Question + Options */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column',
          gap: 0, maxWidth: 680, mx: 'auto', overflow: 'auto',
          '&::-webkit-scrollbar': { display: 'none' } }}>

          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div key={q.currentIndex}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', p: { xs: 2, sm: 2.5 }, mb: 2 }}>
                {/* Timer number */}
                {q.phase === 'question' && (
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography sx={{ color: '#8b949e', fontSize: '0.72rem' }}>
                      Question {qNum} of {qTotal}
                    </Typography>
                    <Typography sx={{
                      fontWeight: 900, fontSize: '1.1rem',
                      color: timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#FFB703' : '#06D6A0',
                    }}>
                      {Math.ceil(timeLeft)}s
                    </Typography>
                  </Box>
                )}
                <Typography sx={{ color: '#fff', fontWeight: 700,
                  fontSize: { xs: '0.95rem', sm: '1.1rem' }, lineHeight: 1.5 }}>
                  {currentQ?.question}
                </Typography>
              </Box>

              {/* Options */}
              <Box>
                {currentQ?.options?.map((opt, idx) => (
                  <OptionButton key={idx}
                    label={OPTION_LABELS[idx]} text={opt} index={idx}
                    phase={q.phase}
                    myAnswer={myAnswer}
                    correctIndex={q.phase === 'reveal' ? currentQ.correctIndex : -1}
                    allAnswers={q.answers}
                    playerCount={total}
                    disabled={!!myAnswer || q.phase !== 'question'}
                    onClick={() => handleAnswer(idx)}
                  />
                ))}
              </Box>

              {/* Waiting message */}
              {q.phase === 'question' && myAnswer && !isHost && (
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                  <Typography sx={{ color: '#8b949e', fontSize: '0.78rem' }}>
                    ✅ Answered! Waiting for others…
                  </Typography>
                </Box>
              )}

              {/* Reveal: score feedback for this question */}
              {q.phase === 'reveal' && myAnswer && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <Box sx={{ textAlign: 'center', mt: 1.5, p: 1.5, borderRadius: '12px',
                    bgcolor: myAnswer.correct ? 'rgba(6,214,160,0.1)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${myAnswer.correct ? 'rgba(6,214,160,0.3)' : 'rgba(239,68,68,0.2)'}` }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '1rem',
                      color: myAnswer.correct ? '#06D6A0' : '#ef4444' }}>
                      {myAnswer.correct ? `+${myAnswer.score} pts` : 'Wrong answer'}
                    </Typography>
                  </Box>
                </motion.div>
              )}
              {/* Reveal: player ran out of time (no answer recorded) */}
              {q.phase === 'reveal' && !myAnswer && (
                <Box sx={{ textAlign: 'center', mt: 1.5, p: 1.5, borderRadius: '12px',
                  bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Typography sx={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem' }}>
                    ⏰ Time ran out!
                  </Typography>
                </Box>
              )}
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* Scoreboard — desktop only */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0, pt: 0.5 }}>
          <Scoreboard q={q} room={room} />
        </Box>
      </Box>

      {/* ── Bottom bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, bgcolor: 'rgba(0,0,0,0.5)',
        borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {/* Mobile score chips */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 0.8, flexWrap: 'wrap' }}>
          {[...(q.playerOrder || [])].sort((a, b) => (q.scores[b] || 0) - (q.scores[a] || 0))
            .slice(0, 4).map((uid, i) => (
            <Chip key={uid} size="small"
              avatar={<Avatar sx={{ bgcolor: OPTION_COLORS[i % 4], width: 18, height: 18, fontSize: '0.55rem' }}>
                {(room.players?.[uid]?.name || '?').charAt(0)}
              </Avatar>}
              label={q.scores[uid] || 0}
              sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#e6edf3',
                fontSize: '0.68rem', height: 22 }}
            />
          ))}
        </Box>
        <Button size="small" variant="outlined" startIcon={<ExitToAppIcon sx={{ fontSize: 14 }} />}
          onClick={requestLeave}
          sx={{ ml: 'auto', fontWeight: 700, fontSize: '0.7rem', py: 0.4, px: 1.5,
            borderRadius: 2, borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444',
            '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
          Leave
        </Button>
      </Box>

      <OfflineBanner online={online} />

      {/* ── Winner overlay ── */}
      <AnimatePresence>
        {q.phase === 'finished' && (
          <WinnerOverlay q={q} room={room} isHost={isHost}
            onReset={handleReset} onLeave={requestLeave} resetting={resetting} />
        )}
      </AnimatePresence>

      <LeaveConfirmModal open={confirmOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </Box>
  );
}

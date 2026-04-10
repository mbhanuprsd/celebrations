// src/games/drawing/DrawingGame.js — mobile-first, big canvas, minimal chat
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Typography, IconButton, Chip, TextField, Avatar } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import SendIcon from '@mui/icons-material/Send';

import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { DrawingGameEngine } from './DrawingGameEngine';
import { DrawingCanvas } from './Canvas';
import { WordSelector } from './WordSelector';
import { RoundEndScreen } from './RoundEndScreen';
import { FinalScores } from './FinalScores';
import { revealHintCharacter, sendChatMessage, submitGuess } from '../../firebase/services';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

// ─── Compact top player strip (~32px tall) ─────────────────────────────────
function PlayerStrip({ players, currentDrawer, guessedPlayers, userId }) {
  return (
    <Box sx={{
      display: 'flex', overflowX: 'auto', gap: 0.6, px: 1, py: 0.4,
      bgcolor: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }}>
      {players.sort((a, b) => b.score - a.score).map(p => {
        const isDrawer = p.id === currentDrawer;
        const guessed  = !!guessedPlayers?.[p.id];
        const isMe     = p.id === userId;
        return (
          <Box key={p.id} sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            flexShrink: 0, px: 0.8, py: 0.25, borderRadius: '20px',
            border: `1.5px solid ${isMe ? '#4CC9F0' : isDrawer ? '#F72585' : 'rgba(255,255,255,0.08)'}`,
            bgcolor: isDrawer ? 'rgba(247,37,133,0.08)' : 'rgba(255,255,255,0.03)',
          }}>
            <Avatar sx={{ bgcolor: p.avatar?.color, width: 20, height: 20, fontSize: '0.58rem', fontWeight: 800 }}>
              {p.avatar?.initials || p.name[0]}
            </Avatar>
            <Box>
              <Typography sx={{ color: isMe ? '#4CC9F0' : '#e6edf3', fontSize: '0.6rem', fontWeight: 800, lineHeight: 1.2,
                maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isMe ? 'You' : p.name} {isDrawer ? '✏️' : guessed ? '✅' : ''}
              </Typography>
              <Typography sx={{ color: '#8b949e', fontSize: '0.56rem', lineHeight: 1 }}>{p.score}</Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Slim timer bar (18px tall) ────────────────────────────────────────────
function TimerBar({ totalTime, startTime, onTimeout }) {
  const [timeLeft, setTimeLeft] = React.useState(totalTime);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!startTime) return;
    calledRef.current = false;
    const tick = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const left    = Math.max(0, totalTime - elapsed);
      setTimeLeft(left);
      if (left === 0 && !calledRef.current) { calledRef.current = true; onTimeout?.(); }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startTime, totalTime, onTimeout]);

  const pct      = (timeLeft / totalTime) * 100;
  const urgent   = timeLeft <= 10;
  const mid      = timeLeft <= 30;
  const barColor = urgent ? '#EF233C' : mid ? '#FFD166' : '#06D6A0';

  return (
    <Box sx={{ height: 18, bgcolor: '#0d1117', flexShrink: 0, display: 'flex', alignItems: 'center', px: 1.5, gap: 1 }}>
      <Box sx={{ flex: 1, height: 4, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: barColor, borderRadius: 3 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </Box>
      <Typography sx={{ color: urgent ? '#EF233C' : '#8b949e', fontWeight: 900, fontSize: '0.68rem',
        minWidth: 18, textAlign: 'right', fontFamily: 'monospace' }}>
        {Math.ceil(timeLeft)}
      </Typography>
    </Box>
  );
}

// ─── Slim hint + round bar (26px tall) ─────────────────────────────────────
function HintBar({ hint, round, maxRounds }) {
  const hintDisplay = (hint || '').split('').map(c =>
    c === '_' ? '_ ' : c === ' ' ? '  ' : `${c} `
  ).join('').trim();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      px: 1.5, minHeight: 26, bgcolor: '#161b22',
      borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
      <Chip label={`${round}/${maxRounds}`} size="small"
        sx={{ bgcolor: 'rgba(76,201,240,0.1)', color: '#4CC9F0',
          border: '1px solid rgba(76,201,240,0.3)', fontWeight: 700, height: 18, fontSize: '0.62rem' }} />
      <motion.div key={hint} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Typography sx={{ fontFamily: 'monospace', fontWeight: 900,
          fontSize: { xs: '0.9rem', sm: '1.1rem' }, letterSpacing: 3, color: '#4CC9F0', textAlign: 'center' }}>
          {hintDisplay || '...'}
        </Typography>
      </motion.div>
      <Box sx={{ width: 38 }} />
    </Box>
  );
}

// ─── Ultra-compact chat strip (last 3 msgs + thin input row) ──────────────
function ChatStrip({ roomId, userId, playerName, room, chat, isDrawer }) {
  const [input, setInput] = useState('');
  const listRef           = useRef(null);
  const hasGuessed        = !!room?.guessedPlayers?.[userId];
  const isPlaying         = room?.status === 'playing';

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chat]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');

    if (!isDrawer && isPlaying && room?.currentWord && !hasGuessed) {
      const correct = await submitGuess(roomId, userId, playerName, text, room.currentWord);
      if (correct) {
        const startMs  = room.roundStartTime?.seconds ? room.roundStartTime.seconds * 1000 : room.roundStartTime;
        const elapsed  = (Date.now() - startMs) / 1000;
        const timeLeft = Math.max(0, room.settings.drawTime - elapsed);
        const engine   = new DrawingGameEngine(roomId, userId, room);
        await engine.onCorrectGuess(userId, playerName, timeLeft, room.settings.drawTime, room.guessedPlayers || {});
        const nonDrawers  = Object.keys(room.players).filter(id => id !== room.currentDrawer);
        const newGuessers = { ...room.guessedPlayers, [userId]: true };
        if (nonDrawers.every(id => newGuessers[id])) await engine.onAllGuessed(room.currentWord);
      }
    } else {
      await sendChatMessage(roomId, userId, playerName, text, 'chat');
    }
  };

  const recentMessages = (chat || []).slice(-3);

  return (
    <Box sx={{ flexShrink: 0, bgcolor: '#161b22', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Last 3 messages — max 48px */}
      <Box
        ref={listRef}
        sx={{
          px: 1.5, pt: 0.4, pb: 0.1,
          maxHeight: 48, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 0.1,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <AnimatePresence initial={false}>
          {recentMessages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }}>
              {msg.type === 'system' ? (
                <Typography sx={{ color: '#4CC9F0', fontSize: '0.63rem', fontStyle: 'italic', textAlign: 'center', lineHeight: 1.3 }}>
                  {msg.text}
                </Typography>
              ) : msg.type === 'correct' ? (
                <Typography sx={{ color: '#06D6A0', fontSize: '0.63rem', fontWeight: 700, lineHeight: 1.3 }}>
                  ✅ {msg.playerName} guessed it!
                </Typography>
              ) : (
                <Typography sx={{ fontSize: '0.65rem', lineHeight: 1.3 }}>
                  <Box component="span" sx={{ color: msg.userId === userId ? '#4CC9F0' : '#F72585', fontWeight: 800 }}>
                    {msg.userId === userId ? 'You' : msg.playerName}:{' '}
                  </Box>
                  <Box component="span" sx={{ color: '#e6edf3' }}>{msg.text}</Box>
                </Typography>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </Box>

      {/* Input row — 32px high */}
      <Box
        component="form" onSubmit={send}
        sx={{ display: 'flex', gap: 0.5, px: 1, pb: 'max(5px, env(safe-area-inset-bottom))', pt: 0.25 }}
      >
        <TextField
          fullWidth size="small" variant="outlined"
          placeholder={isDrawer && isPlaying ? "You're drawing 🤫" : hasGuessed ? 'Chat freely 🎉' : 'Type your guess…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isDrawer && isPlaying}
          inputProps={{ maxLength: 60 }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5, fontSize: '0.76rem', bgcolor: '#0d1117', height: 30,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
            },
          }}
        />
        <IconButton
          type="submit"
          disabled={!input.trim() || (isDrawer && isPlaying)}
          sx={{
            bgcolor: '#4CC9F0', color: '#0d1117', borderRadius: 1.5,
            width: 30, height: 30, flexShrink: 0,
            '&:hover': { bgcolor: '#7ED8F7' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: '#30363d' },
          }}
        >
          <SendIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

// ─── Main DrawingGame ──────────────────────────────────────────────────────
export function DrawingGame() {
  const { state, notify } = useGameContext();
  const { leave }         = useRoom();
  const { room, isDrawer, userId, roomId, chat, isHost } = state;
  const engineRef        = useRef(null);
  const timeoutCalledRef = useRef(false);

  useEffect(() => {
    if (room && userId) {
      engineRef.current = new DrawingGameEngine(roomId, userId, room);
      engineRef.current.onRoomUpdate(room);
    }
  }, [room, userId, roomId]);

  // Hint reveals (host only)
  useEffect(() => {
    if (!isHost || room?.status !== 'playing' || !room?.currentWord || !room?.roundStartTime) return;
    timeoutCalledRef.current = false;
    const totalTime = room.settings.drawTime;
    const startMs   = room.roundStartTime?.seconds ? room.roundStartTime.seconds * 1000 : room.roundStartTime;
    [0.6, 0.3].forEach(pct => {
      const remaining = (totalTime * pct * 1000) - (Date.now() - startMs);
      if (remaining > 0) setTimeout(async () => {
        const { getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'rooms', roomId));
        const cur  = snap.data();
        if (cur?.status !== 'playing' || !cur?.currentWord) return;
        const newHint = revealHintCharacter(cur.currentWord, cur.currentWordHint);
        await updateDoc(doc(db, 'rooms', roomId), { currentWordHint: newHint });
      }, remaining);
    });
  }, [room?.roundStartTime, isHost, roomId]);

  const handleTimeout = useCallback(async () => {
    if (!isHost || timeoutCalledRef.current) return;
    timeoutCalledRef.current = true;
    if (engineRef.current && room?.currentWord) await engineRef.current.onRoundTimeout(room.currentWord);
  }, [isHost, room?.currentWord]);

  const handleWordSelected = async (word) => {
    if (engineRef.current) await engineRef.current.onWordSelected(word);
  };

  if (!room) return null;
  if (room.status === 'finished') return <FinalScores />;

  const players     = Object.values(room.players || {});
  const isPlaying   = room.status === 'playing';
  const startTimeMs = room.roundStartTime?.seconds
    ? room.roundStartTime.seconds * 1000
    : room.roundStartTime || null;

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: '#0d1117', overflow: 'hidden' }}>

      {/* ── Top bar — 38px ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, height: 38, bgcolor: '#161b22',
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        <Typography sx={{
          fontFamily: '"Fredoka One", cursive', fontSize: '1.05rem',
          background: 'linear-gradient(135deg, #4CC9F0, #F72585)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Scribbly
        </Typography>
        <Box display="flex" alignItems="center" gap={0.8}>
          {isDrawer && isPlaying && (
            <Chip label={`✏️ ${room.currentWord}`} size="small"
              sx={{ bgcolor: 'rgba(247,37,133,0.15)', color: '#F72585',
                border: '1px solid rgba(247,37,133,0.3)', fontWeight: 800, fontSize: '0.68rem', height: 20 }} />
          )}
          <Chip label={roomId} size="small"
            onClick={() => { navigator.clipboard.writeText(roomId); notify('Copied!'); }}
            sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
              bgcolor: 'rgba(255,255,255,0.05)', color: '#8b949e', height: 20, fontSize: '0.65rem' }} />
          <IconButton size="small" onClick={leave} sx={{ color: '#EF233C', p: 0.3 }}>
            <ExitToAppIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* ── Player strip — ~30px ── */}
      <PlayerStrip players={players} currentDrawer={room.currentDrawer}
        guessedPlayers={room.guessedPlayers} userId={userId} />

      {/* ── Hint bar — ~26px ── */}
      <HintBar hint={room.currentWordHint} round={room.currentRound} maxRounds={room.settings?.rounds} />

      {/* ── Timer bar — 18px ── */}
      {isPlaying && startTimeMs && (
        <TimerBar totalTime={room.settings.drawTime} startTime={startTimeMs}
          onTimeout={isHost ? handleTimeout : undefined} />
      )}

      {/* ── Canvas — fills everything remaining ── */}
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <DrawingCanvas roomId={roomId} canDraw={isDrawer && isPlaying} word={isDrawer ? room.currentWord : null} />
      </Box>

      {/* ── Chat strip — ~78px (48px msgs + 30px input) ── */}
      <ChatStrip roomId={roomId} userId={userId} playerName={state.me?.name || ''}
        room={room} chat={chat} isDrawer={isDrawer} />

      {/* ── Overlays ── */}
      <AnimatePresence>
        {room.status === 'selectingWord' && (
          <WordSelector key="ws" roomId={roomId} userId={userId} room={room} onWordSelected={handleWordSelected} />
        )}
        {room.status === 'roundEnd' && <RoundEndScreen key="re" room={room} />}
      </AnimatePresence>
    </Box>
  );
}

// src/games/drawing/DrawingGame.js — mobile-first, big canvas, on-screen keyboard
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Typography, IconButton, Chip, Avatar } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { useGameGuard } from '../../hooks/useGameSession';
import { OfflineBanner, LeaveConfirmModal } from '../../components/GameSharedUI';
import { DrawingGameEngine } from './DrawingGameEngine';
import { DrawingCanvas } from './Canvas';
import { WordSelector } from './WordSelector';
import { RoundEndScreen } from './RoundEndScreen';
import { FinalScores } from './FinalScores';
import { revealHintCharacter, submitGuess, sendChatMessage } from '../../firebase/services';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

// ─── Keyboard layout ─────────────────────────────────────────────────────────
const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M','⌫'],
  ['.', '-', 'SPACE', '.', '➤'],
];

// ─── Compact top player strip (~30px) ────────────────────────────────────────
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

// ─── Slim timer bar (18px) ────────────────────────────────────────────────────
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

// ─── Slim hint + round bar (26px) ────────────────────────────────────────────
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

// ─── On-screen guess keyboard (Blue Drawize-style) ──────────────────────────
function GuessKeyboard({ roomId, userId, playerName, room }) {
  const [typed, setTyped]   = useState('');
  const [flash, setFlash]   = useState(null); // 'correct' | 'wrong' | null
  const hasGuessed          = !!room?.guessedPlayers?.[userId];
  const isPlaying           = room?.status === 'playing';

  useEffect(() => { setTyped(''); setFlash(null); }, [room?.currentWord]);

  const handleKey = (key) => {
    if (flash) return;
    if (key === '⌫') { setTyped(t => t.slice(0, -1)); return; }
    if (key === 'SPACE') { if (typed.length < 30) setTyped(t => t + ' '); return; }
    if (key === '➤') { handleSubmit(); return; }
    if (key === '.') { if (typed.length < 30) setTyped(t => t + '.'); return; }
    if (key === '-') { if (typed.length < 30) setTyped(t => t + '-'); return; }
    if (typed.length >= 30) return;
    setTyped(t => t + key);
  };

  const handleSubmit = async () => {
    const text = typed.trim();
    if (!text || flash) return;
    if (!hasGuessed && isPlaying && room?.currentWord) {
      const correct = await submitGuess(roomId, userId, playerName, text, room.currentWord);
      if (correct) {
        setFlash('correct');
        const startMs  = room.roundStartTime?.seconds ? room.roundStartTime.seconds * 1000 : room.roundStartTime;
        const elapsed  = (Date.now() - startMs) / 1000;
        const timeLeft = Math.max(0, room.settings.drawTime - elapsed);
        const engine   = new DrawingGameEngine(roomId, userId, room);
        await engine.onCorrectGuess(userId, playerName, timeLeft, room.settings.drawTime, room.guessedPlayers || {});
        const nonDrawers  = Object.keys(room.players).filter(id => id !== room.currentDrawer);
        const newGuessers = { ...room.guessedPlayers, [userId]: true };
        if (nonDrawers.every(id => newGuessers[id])) await engine.onAllGuessed(room.currentWord);
        setTimeout(() => { setFlash(null); setTyped(''); }, 1200);
      } else {
        setFlash('wrong');
        setTimeout(() => { setFlash(null); setTyped(''); }, 600);
      }
    } else {
      await sendChatMessage(roomId, userId, playerName, text, 'chat');
      setTyped('');
    }
  };

  // ── Already guessed ──
  if (hasGuessed) {
    return (
      <Box sx={{ flexShrink: 0, background: 'linear-gradient(180deg, #0D47A1, #0a3a82)',
        borderTop: '2px solid rgba(34,197,94,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, px: 2 }}>
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <Typography sx={{ color: '#4ade80', fontWeight: 900, fontSize: '0.9rem' }}>
            ✅ Correct! Watch the others…
          </Typography>
        </motion.div>
      </Box>
    );
  }

  if (!isPlaying) {
    return (
      <Box sx={{ flexShrink: 0, background: 'linear-gradient(180deg, #0D47A1, #0a3a82)',
        borderTop: '1px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Waiting for round to start…</Typography>
      </Box>
    );
  }

  const flashBorderColor = flash === 'correct' ? '#4ade80' : flash === 'wrong' ? '#f87171' : 'rgba(255,255,255,0.5)';
  const flashBg          = flash === 'correct' ? 'rgba(74,222,128,0.18)' : flash === 'wrong' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.08)';

  return (
    <Box sx={{
      flexShrink: 0,
      background: 'linear-gradient(180deg, #1565C0 0%, #0D47A1 100%)',
      borderTop: '2px solid rgba(255,255,255,0.2)',
      display: 'flex', flexDirection: 'column',
      pb: 'max(4px, env(safe-area-inset-bottom))',
      userSelect: 'none',
    }}>
      {/* Input row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1.2, pt: 0.8, pb: 0.5 }}>
        <Box sx={{
          flex: 1, height: 36, px: 1.4, borderRadius: '10px',
          bgcolor: flashBg, border: `2px solid ${flashBorderColor}`,
          display: 'flex', alignItems: 'center', gap: 0.5, transition: 'all 0.18s', overflow: 'hidden',
        }}>
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem',
            color: flash === 'correct' ? '#4ade80' : flash === 'wrong' ? '#f87171' : 'white',
            flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {flash === 'correct' ? '✅ Correct!' : flash === 'wrong' ? '❌ Try again!' : typed ||
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'inherit', fontWeight: 400 }}>Type your guess…</Box>}
          </Typography>
          {!flash && (
            <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.9, repeat: Infinity }}
              style={{ width: 2, height: 16, background: 'white', borderRadius: 1, flexShrink: 0 }} />
          )}
        </Box>
        <Box component={motion.div} whileTap={typed.trim() && !flash ? { scale: 0.82 } : {}}
          onClick={handleSubmit}
          sx={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
            bgcolor: typed.trim() && !flash ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
            border: `1.5px solid ${typed.trim() && !flash ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: typed.trim() && !flash ? 'pointer' : 'default', transition: 'all 0.15s' }}>
          <Typography sx={{ fontSize: '1.1rem', opacity: typed.trim() && !flash ? 1 : 0.3 }}>➤</Typography>
        </Box>
      </Box>

      {/* Keyboard rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', px: '8px', pb: '6px' }}>
        {KB_ROWS.map((row, ri) => (
          <Box key={ri} sx={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
            {row.map(key => {
              const isBack  = key === '⌫';
              const isSend  = key === '➤';
              const isSpace = key === 'SPACE';
              const isDot   = key === '.' || key === '-';
              return (
                <Box key={key} component={motion.div}
                  whileTap={{ scale: 0.78, y: 1 }}
                  onClick={() => handleKey(key)}
                  sx={{
                    flex: isSpace ? 4 : isBack ? 1.6 : isSend ? 1.4 : isDot ? 0.9 : 1,
                    minWidth: isSpace ? 70 : isBack ? 34 : isSend ? 36 : isDot ? 22 : 26,
                    maxWidth: isSpace ? 200 : isBack ? 52 : isSend ? 52 : isDot ? 38 : 44,
                    height: 38,
                    // Blue key styling like screenshot
                    border: `1.5px solid rgba(255,255,255,${isSend ? '0.85' : isBack ? '0.5' : '0.45'})`,
                    borderRadius: '7px',
                    bgcolor: isSend ? 'rgba(255,255,255,0.2)' : isBack ? 'rgba(255,100,100,0.18)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.1s',
                    '&:active': { bgcolor: isSend ? 'rgba(255,255,255,0.35)' : isBack ? 'rgba(255,100,100,0.35)' : 'rgba(255,255,255,0.2)' },
                  }}>
                  {isBack ? (
                    <Typography sx={{ fontSize: '0.9rem', color: '#fca5a5' }}>⌫</Typography>
                  ) : isSend ? (
                    <Typography sx={{ fontSize: '1rem', color: 'white' }}>➤</Typography>
                  ) : isSpace ? (
                    <Box sx={{ width: '50%', height: 2, bgcolor: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
                  ) : (
                    <Typography sx={{ fontSize: ri < 3 ? '0.78rem' : '0.72rem', fontWeight: 700,
                      color: 'rgba(255,255,255,0.92)', lineHeight: 1 }}>
                      {key}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}


// ─── Main DrawingGame ─────────────────────────────────────────────────────────
export function DrawingGame() {
  const { state, notify } = useGameContext();
  const { leave }         = useRoom();
  const { room, isDrawer, userId, roomId, isHost } = state;
  const engineRef        = useRef(null);
  const timeoutCalledRef = useRef(false);

  const { online, confirmOpen, requestLeave, cancelLeave, confirmLeave } = useGameGuard({
    roomId, userId, gameType: room?.gameType || 'drawing', leaveCallback: leave,
  });

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
  }, [room?.roundStartTime, room?.currentWord, room?.status, room?.settings.drawTime, isHost, roomId]);

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
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: '#0d1117', overflow: 'hidden', position: 'relative' }}>

      <OfflineBanner online={online} />

      {/* ── Top bar — 38px ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, height: 38, bgcolor: '#161b22', mt: !online ? '36px' : 0,
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, transition: 'margin 0.3s',
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
          <IconButton size="small" onClick={requestLeave} sx={{ color: '#EF233C', p: 0.3 }}>
            <ExitToAppIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* ── Player strip — ~30px ── */}
      <PlayerStrip players={players} currentDrawer={room.currentDrawer}
        guessedPlayers={room.guessedPlayers} userId={userId} />

      {/* ── Hint + round bar — 26px ── */}
      <HintBar hint={room.currentWordHint} round={room.currentRound} maxRounds={room.settings?.rounds} />

      {/* ── Timer bar — 18px ── */}
      {isPlaying && startTimeMs && (
        <TimerBar totalTime={room.settings.drawTime} startTime={startTimeMs}
          onTimeout={isHost ? handleTimeout : undefined} />
      )}

      {/* ── Canvas — flex 1, fills remaining space ── */}
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <DrawingCanvas roomId={roomId} canDraw={isDrawer && isPlaying} word={isDrawer ? room.currentWord : null} />
      </Box>

      {/* ── On-screen keyboard — guessers only ── */}
      {!isDrawer && (
        <GuessKeyboard
          roomId={roomId}
          userId={userId}
          playerName={state.me?.name || ''}
          room={room}
        />
      )}

      {/* ── Overlays ── */}
      <AnimatePresence>
        {room.status === 'selectingWord' && (
          <WordSelector key="ws" roomId={roomId} userId={userId} room={room} onWordSelected={handleWordSelected} />
        )}
        {room.status === 'roundEnd' && <RoundEndScreen key="re" room={room} />}
      </AnimatePresence>

      <LeaveConfirmModal open={confirmOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </Box>
  );
}
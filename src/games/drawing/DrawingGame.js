// src/games/drawing/DrawingGame.js
import React, { useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, AppBar, Toolbar, IconButton,
  Chip, Tooltip, useMediaQuery, useTheme
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { DrawingGameEngine } from './DrawingGameEngine';
import { DrawingCanvas } from './Canvas';
import { ChatPanel } from './ChatPanel';
import { PlayerListPanel } from './PlayerListPanel';
import { WordSelector } from './WordSelector';
import { RoundTimer } from './RoundTimer';
import { RoundEndScreen } from './RoundEndScreen';
import { FinalScores } from './FinalScores';
import { revealHintCharacter } from '../../firebase/services';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

export function DrawingGame() {
  const { state, notify } = useGameContext();
  const { leave } = useRoom();
  const { room, isDrawer, userId, roomId, chat, isHost } = state;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const engineRef = useRef(null);
  const hintTimerRef = useRef(null);
  const timeoutCalledRef = useRef(false);

  // Build engine when room changes
  useEffect(() => {
    if (room && userId) {
      engineRef.current = new DrawingGameEngine(roomId, userId, room);
      engineRef.current.onRoomUpdate(room);
    }
  }, [room, userId, roomId]);

  // Hint reveal timer (host only drives this)
  useEffect(() => {
    if (!isHost || room?.status !== 'playing' || !room?.currentWord || !room?.roundStartTime) return;
    clearTimeout(hintTimerRef.current);
    timeoutCalledRef.current = false;

    const totalTime = room.settings.drawTime;
    const startMs = room.roundStartTime?.seconds
      ? room.roundStartTime.seconds * 1000
      : room.roundStartTime;

    // Reveal hints at 60% and 30% time remaining
    const revealAt = [0.6, 0.3];
    revealAt.forEach(pct => {
      const delay = (totalTime * pct) * 1000;
      const elapsed = Date.now() - startMs;
      const remaining = delay - elapsed;
      if (remaining > 0) {
        setTimeout(async () => {
          if (room?.status !== 'playing') return;
          const snap = await import('firebase/firestore').then(m =>
            m.getDoc(doc(db, 'rooms', roomId))
          );
          const current = snap.data();
          if (current?.status !== 'playing' || !current?.currentWord) return;
          const newHint = revealHintCharacter(current.currentWord, current.currentWordHint);
          await updateDoc(doc(db, 'rooms', roomId), { currentWordHint: newHint });
        }, remaining);
      }
    });
  }, [room?.roundStartTime, isHost, roomId]);

  const handleTimeout = useCallback(async () => {
    if (!isHost || timeoutCalledRef.current) return;
    timeoutCalledRef.current = true;
    if (engineRef.current && room?.currentWord) {
      await engineRef.current.onRoundTimeout(room.currentWord);
    }
  }, [isHost, room?.currentWord]);

  const handleWordSelected = async (word) => {
    if (engineRef.current) {
      await engineRef.current.onWordSelected(word);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    notify('Room code copied! 📋');
  };

  if (!room) return null;

  // Finished state
  if (room.status === 'finished') {
    return <FinalScores />;
  }

  const isSelectingWord = room.status === 'selectingWord';
  const isRoundEnd = room.status === 'roundEnd';
  const isPlaying = room.status === 'playing';

  const startTimeMs = room.roundStartTime?.seconds
    ? room.roundStartTime.seconds * 1000
    : room.roundStartTime || null;

  const wordHint = room.currentWordHint || '';
  const hintDisplay = wordHint.split('').map((c, i) =>
    c === ' ' ? ' ' : (c === '_' ? '_ ' : `${c} `)
  ).join('').trim();

  const players = Object.values(room.players || {});
  const nonDrawers = players.filter(p => p.id !== room.currentDrawer);
  const guessedCount = Object.keys(room.guessedPlayers || {}).length;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#F0F4FF' }}>
      {/* Top bar */}
      <AppBar position="static" elevation={0} sx={{
        bgcolor: 'white', borderBottom: '1px solid rgba(67,97,238,0.1)',
        color: 'text.primary',
      }}>
        <Toolbar variant="dense" sx={{ gap: 1, minHeight: 52, px: 2 }}>
          <Typography variant="h6" sx={{
            fontFamily: '"Fredoka One", cursive',
            background: 'linear-gradient(135deg, #4361EE, #F72585)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            mr: 1, flexShrink: 0,
          }}>
            Scribbly
          </Typography>

          {/* Round info */}
          <Chip label={`Round ${room.currentRound}/${room.settings?.rounds}`}
            size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />

          {/* Hint display */}
          {isPlaying && room.currentWordHint && (
            <motion.div
              key={room.currentWordHint}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ flex: 1, textAlign: 'center', overflow: 'hidden' }}
            >
              <Typography sx={{
                fontFamily: 'monospace', fontWeight: 800, fontSize: { xs: '1rem', md: '1.4rem' },
                letterSpacing: { xs: 2, md: 4 }, color: '#4361EE',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {hintDisplay}
              </Typography>
            </motion.div>
          )}

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Copy room code">
              <Chip label={roomId} size="small" variant="outlined"
                onClick={copyCode} icon={<ContentCopyIcon sx={{ fontSize: '14px!important' }} />}
                sx={{ cursor: 'pointer', fontWeight: 700, fontFamily: 'monospace', letterSpacing: 2 }}
              />
            </Tooltip>
            <Tooltip title="Leave game">
              <IconButton size="small" onClick={leave} color="error">
                <ExitToAppIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>

        {/* Timer bar */}
        {isPlaying && startTimeMs && (
          <Box sx={{ px: 2, pb: 1 }}>
            <RoundTimer
              totalTime={room.settings.drawTime}
              startTime={startTimeMs}
              onTimeout={isHost ? handleTimeout : undefined}
            />
          </Box>
        )}
      </AppBar>

      {/* Main game area */}
      <Box sx={{
        flex: 1, display: 'grid', overflow: 'hidden', p: { xs: 1, md: 1.5 }, gap: 1.5,
        gridTemplateColumns: { xs: '1fr', md: '180px 1fr 240px' },
        gridTemplateRows: { xs: 'auto 1fr auto', md: '1fr' },
      }}>
        {/* Player list - left */}
        <Box sx={{
          gridColumn: { xs: '1', md: '1' },
          gridRow: { xs: '1', md: '1' },
          overflowY: 'auto',
          display: { xs: 'none', md: 'block' },
        }}>
          <PlayerListPanel room={room} userId={userId} />
        </Box>

        {/* Canvas - center */}
        <Box sx={{ gridColumn: { xs: '1', md: '2' }, gridRow: { xs: '2', md: '1' }, overflow: 'hidden' }}>
          <DrawingCanvas roomId={roomId} canDraw={isDrawer && isPlaying} word={isDrawer ? room.currentWord : null} />
        </Box>

        {/* Chat - right */}
        <Box sx={{
          gridColumn: { xs: '1', md: '3' },
          gridRow: { xs: '3', md: '1' },
          height: { xs: 280, md: 'auto' },
          overflow: 'hidden',
        }}>
          <ChatPanel
            roomId={roomId} userId={userId}
            playerName={state.me?.name || ''}
            room={room} chat={chat} isDrawer={isDrawer}
          />
        </Box>
      </Box>

      {/* Mobile player count bar */}
      {isMobile && (
        <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 0.5, overflowX: 'auto' }}>
          {players.map(p => (
            <Chip key={p.id} size="small"
              avatar={<Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: p.avatar?.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: 'white' }}>{p.avatar?.initials}</Typography>
              </Box>}
              label={`${p.score}`}
              variant={p.id === room.currentDrawer ? 'filled' : 'outlined'}
              color={p.id === room.currentDrawer ? 'secondary' : 'default'}
              sx={{ fontSize: '0.7rem', fontWeight: 700 }}
            />
          ))}
        </Box>
      )}

      {/* Overlays */}
      <AnimatePresence>
        {isSelectingWord && (
          <WordSelector
            key="word-selector"
            roomId={roomId} userId={userId} room={room}
            onWordSelected={handleWordSelected}
          />
        )}
        {isRoundEnd && (
          <RoundEndScreen key="round-end" room={room} />
        )}
      </AnimatePresence>
    </Box>
  );
}

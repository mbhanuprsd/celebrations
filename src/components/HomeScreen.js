// src/components/HomeScreen.js
import React, { useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Slider, CircularProgress, Alert, Collapse, IconButton,
  Chip, Avatar, Skeleton, Tooltip,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LoginIcon from '@mui/icons-material/Login';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import GroupIcon from '@mui/icons-material/Group';
import { useRoom } from '../hooks/useRoom';
import { useOpenRooms } from '../hooks/useOpenRooms';
import { useOnlineUsers } from '../hooks/useOnlineUsers';
import { useGameContext } from '../context/GameContext';
import { GAME_META } from '../core/GameEngine';
import { listenActiveGames, getUserGameHistory } from '../firebase/services';
import { useState as useStateInner, useEffect } from 'react';
import { getStoredSession } from '../hooks/useGameSession';
import { ResumeBanner } from './GameSharedUI';

const GAME_GRADIENTS = {
  drawing: 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)',
  ludo: 'linear-gradient(135deg, #FFD166 0%, #EF476F 100%)',
  snakeladder: 'linear-gradient(135deg, #06D6A0 0%, #118AB2 100%)',
  uno: 'linear-gradient(135deg, #DC2626 0%, #7c3aed 100%)',
};
const GAME_GLOW = { drawing: '#4CC9F0', ludo: '#FFD166', snakeladder: '#06D6A0', uno: '#a855f7' };

function BgOrbs() {
  const orbs = [
    { color: '#4CC9F0', size: 240, top: '2%', left: '-10%', delay: 0 },
    { color: '#F72585', size: 190, top: '55%', right: '-8%', delay: 1.5 },
    { color: '#7209B7', size: 160, bottom: '3%', left: '8%', delay: 0.8 },
    { color: '#FFD166', size: 120, top: '28%', right: '3%', delay: 2.2 },
  ];
  return (
    <>
      {orbs.map((o, i) => (
        <motion.div key={i} style={{
          position: 'fixed', width: o.size, height: o.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color}20, transparent 70%)`,
          top: o.top, left: o.left, right: o.right, bottom: o.bottom,
          pointerEvents: 'none', zIndex: 0,
        }}
          animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 5 + i, repeat: Infinity, delay: o.delay }} />
      ))}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 0, opacity: 0.025, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(76,201,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(76,201,240,1) 1px, transparent 1px)',
        backgroundSize: '36px 36px'
      }} />
    </>
  );
}

function SettingSlider({ label, icon, value, color, min, max, step = 1, marks, unit = '', onChange }) {
  return (
    <Box sx={{ mb: 1.8, p: 1.5, bgcolor: `${color}08`, borderRadius: '14px', border: `1px solid ${color}18` }}>
      <Box display="flex" justifyContent="space-between" mb={0.7}>
        <Typography sx={{ color: '#8b949e', fontSize: '0.78rem', fontWeight: 700 }}>{icon} {label}</Typography>
        <Typography sx={{ color, fontWeight: 900, fontSize: '1rem' }}>{value}{unit}</Typography>
      </Box>
      <Slider value={value} min={min} max={max} step={step} onChange={(_, v) => onChange(v)} marks={marks}
        sx={{
          color, py: 0.5,
          '& .MuiSlider-thumb': { width: 18, height: 18, boxShadow: `0 0 0 4px ${color}22` },
          '& .MuiSlider-markLabel': { color: '#484f58', fontSize: '0.64rem', fontWeight: 700 },
        }} />
    </Box>
  );
}

function GameTypePicker({ selected, onChange }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, mb: 2.5 }}>
      {Object.entries(GAME_META).map(([key, meta]) => {
        const sel = selected === key;
        const glow = GAME_GLOW[key] || '#4CC9F0';
        return (
          <motion.div key={key} whileHover={{ y: -3 }} whileTap={{ scale: 0.94 }}>
            <Box onClick={() => onChange(key)} sx={{
              border: sel ? `2px solid ${glow}` : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px', p: 1.2, cursor: 'pointer', textAlign: 'center',
              background: sel ? `${glow}14` : 'rgba(255,255,255,0.025)',
              boxShadow: sel ? `0 0 18px ${glow}40` : 'none', transition: 'all 0.18s',
            }}>
              <Typography sx={{ fontSize: '1.6rem', lineHeight: 1.1, mb: 0.25 }}>{meta.icon}</Typography>
              <Typography sx={{ fontSize: '0.63rem', fontWeight: 900, color: sel ? glow : '#c9d1d9', display: 'block' }}>
                {meta.label}
              </Typography>
              <Typography sx={{ fontSize: '0.56rem', color: '#484f58' }}>{meta.minPlayers}–{meta.maxPlayers}p</Typography>
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
}

function OpenRoomCard({ room, setLocalError }) {
  const [joining, setJoining] = useState(false);
  const { join } = useRoom();
  const { state } = useGameContext();
  const meta = GAME_META[room.gameType] || GAME_META.drawing;
  const glow = GAME_GLOW[room.gameType] || '#4CC9F0';
  const grad = GAME_GRADIENTS[room.gameType] || GAME_GRADIENTS.drawing;
  const players = Object.values(room.players || {});
  const hostName = players.find(p => p.id === room.hostId)?.name || 'Host';
  const maxP = room.settings?.maxPlayers || 8;
  const spots = maxP - players.length;
  const isFull = spots <= 0;

  const handleJoin = async () => {
    if (isFull) return;
    setJoining(true);
    const ok = await join(room.id, state.playerName);
    if (!ok) setLocalError(state.error || 'Could not join');
    setJoining(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
      <Box sx={{
        border: `1px solid ${glow}28`, borderRadius: '18px',
        background: `linear-gradient(135deg, ${glow}07, rgba(14,18,27,0.97))`,
        p: '14px 16px', mb: 1.2, boxShadow: `0 4px 20px ${glow}10`,
        position: 'relative', overflow: 'hidden'
      }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad, borderRadius: '18px 18px 0 0' }} />
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
            background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', boxShadow: `0 4px 12px ${glow}40`
          }}>{meta.icon}</Box>
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" gap={0.7} flexWrap="wrap">
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem', color: glow, letterSpacing: '3px' }}>{room.id}</Typography>
              <Chip label={meta.label} size="small" sx={{ height: 17, fontSize: '0.57rem', fontWeight: 800, background: `${glow}20`, color: glow, border: `1px solid ${glow}35` }} />
            </Box>
            <Box display="flex" alignItems="center" gap={0.5} mt={0.25}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 5px #22C55E' }} />
              <Typography sx={{ fontSize: '0.69rem', color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hostName}'s room
              </Typography>
            </Box>
            <Box display="flex" gap={0.5} mt={0.3} flexWrap="wrap">
              <Chip icon={<GroupIcon sx={{ fontSize: '10px!important' }} />} label={`${players.length}/${maxP}`} size="small"
                sx={{ height: 17, fontSize: '0.59rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.05)', color: '#c9d1d9', border: '1px solid rgba(255,255,255,0.09)' }} />
              {isFull
                ? <Chip label="Full" size="small" sx={{ height: 17, fontSize: '0.57rem', fontWeight: 800, bgcolor: 'rgba(239,35,60,0.12)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.25)' }} />
                : <Chip label={`${spots} open`} size="small" sx={{ height: 17, fontSize: '0.57rem', fontWeight: 800, bgcolor: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.28)' }} />}
            </Box>
          </Box>
          <Button variant="contained" size="small" onClick={handleJoin} disabled={isFull || joining}
            sx={{
              flexShrink: 0, background: isFull ? 'rgba(255,255,255,0.05)' : grad,
              color: isFull ? '#484f58' : (room.gameType === 'ludo' ? '#1a0800' : 'white'),
              fontWeight: 900, fontSize: '0.72rem', borderRadius: '10px', px: 1.4, py: 0.7,
              minWidth: 62, boxShadow: isFull ? 'none' : `0 4px 12px ${glow}40`,
              '&:hover': { filter: 'brightness(1.12)' }
            }}>
            {joining ? <CircularProgress size={12} color="inherit" /> : isFull ? 'Full' : 'Join'}
          </Button>
        </Box>
        {players.length > 0 && (
          <Box display="flex" gap={0.4} mt={1} pl={0.5}>
            {players.slice(0, 9).map((p, i) => (
              <Tooltip key={p.id} title={p.name}>
                <Avatar sx={{
                  width: 20, height: 20, bgcolor: p.avatar?.color || glow, fontSize: '0.55rem',
                  fontWeight: 900, border: '1.5px solid rgba(0,0,0,0.3)', ml: i > 0 ? '-5px' : 0
                }}>
                  {(p.avatar?.initials || p.name?.charAt(0) || '?').slice(0, 2)}
                </Avatar>
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>
    </motion.div>
  );
}

function OpenRoomsPanel({ setLocalError }) {
  const { rooms, loading } = useOpenRooms();
  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 8px #22C55E' }} />
          </motion.div>
          <Typography sx={{ fontWeight: 900, fontSize: '0.76rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Open Rooms
          </Typography>
          {!loading && rooms.length > 0 && (
            <Chip label={rooms.length} size="small" sx={{
              height: 17, minWidth: 22, fontSize: '0.62rem', fontWeight: 900,
              bgcolor: 'rgba(34,197,94,0.14)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.28)'
            }} />
          )}
        </Box>
        <Typography sx={{ fontSize: '0.66rem', color: '#484f58' }}>Live</Typography>
      </Box>
      {loading ? (
        [0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={88} sx={{ mb: 1.2, borderRadius: '18px', bgcolor: 'rgba(255,255,255,0.04)' }} />)
      ) : rooms.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.015)' }}>
          <Typography sx={{ fontSize: '2rem', mb: 0.5 }}>🎮</Typography>
          <Typography sx={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 700 }}>No open rooms right now</Typography>
          <Typography sx={{ color: '#484f58', fontSize: '0.7rem', mt: 0.3 }}>Create one and invite friends!</Typography>
        </Box>
      ) : (
        <AnimatePresence>
          {rooms.map((room, i) => (
            <motion.div key={room.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <OpenRoomCard room={room} setLocalError={setLocalError} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </Box>
  );
}

function OnlineUsersStrip() {
  const { users, count } = useOnlineUsers();
  if (count === 0) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 7px #22C55E' }} />
        </motion.div>
        <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Online Now
        </Typography>
        <Chip label={count} size="small" sx={{
          height: 16, minWidth: 22, fontSize: '0.6rem', fontWeight: 900,
          bgcolor: 'rgba(34,197,94,0.14)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.28)'
        }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {users.map((u) => {
          const initials = (u.name || '?').slice(0, 2).toUpperCase();
          const hue = [...(u.name || 'x')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
          const color = `hsl(${hue}, 70%, 55%)`;
          return (
            <Tooltip key={u.uid} title={u.name}>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.35,
                borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${color}30`,
                cursor: 'default'
              }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar sx={{ width: 18, height: 18, bgcolor: color, fontSize: '0.5rem', fontWeight: 900 }}>
                    {initials}
                  </Avatar>
                  <Box sx={{
                    position: 'absolute', bottom: -1, right: -1, width: 6, height: 6,
                    borderRadius: '50%', bgcolor: '#22C55E', border: '1.5px solid #080c12'
                  }} />
                </Box>
                <Typography sx={{
                  fontSize: '0.65rem', fontWeight: 700, color: '#c9d1d9', maxWidth: 60,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {u.name}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

function ActiveGamesPanel() {
  const [games, setGames] = useStateInner([]);

  useEffect(() => {
    const unsub = listenActiveGames(setGames);
    return unsub;
  }, []);

  if (games.length === 0) return null;

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1.2}>
        <Typography sx={{ fontSize: '0.9rem' }}>🎮</Typography>
        <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Live Games
        </Typography>
        <Chip label={games.length} size="small" sx={{
          height: 16, minWidth: 22, fontSize: '0.6rem', fontWeight: 900,
          bgcolor: 'rgba(247,37,133,0.14)', color: '#F72585', border: '1px solid rgba(247,37,133,0.28)'
        }} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {games.map((room) => {
          const meta = GAME_META[room.gameType] || GAME_META.drawing;
          const glow = GAME_GLOW[room.gameType] || '#4CC9F0';
          const grad = GAME_GRADIENTS[room.gameType] || GAME_GRADIENTS.drawing;
          const players = Object.values(room.players || {});
          return (
            <Box key={room.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.2,
              border: `1px solid ${glow}20`, borderRadius: '14px',
              background: `linear-gradient(135deg, ${glow}06, rgba(14,18,27,0.9))`,
              p: '10px 14px', position: 'relative', overflow: 'hidden'
            }}>
              <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: grad, borderRadius: '14px 0 0 14px' }} />
              <Box sx={{
                width: 32, height: 32, borderRadius: '10px', flexShrink: 0,
                background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', boxShadow: `0 3px 10px ${glow}35`
              }}>
                {meta.icon}
              </Box>
              <Box flex={1} minWidth={0}>
                <Box display="flex" alignItems="center" gap={0.6}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: glow, fontFamily: 'monospace', letterSpacing: '2px' }}>
                    {room.id}
                  </Typography>
                  <Chip label={meta.label} size="small" sx={{
                    height: 14, fontSize: '0.54rem', fontWeight: 800,
                    background: `${glow}20`, color: glow, border: `1px solid ${glow}35`
                  }} />
                </Box>
                <Box display="flex" alignItems="center" gap={0.4} mt={0.2}>
                  <Box sx={{ display: 'flex', gap: 0 }}>
                    {players.slice(0, 6).map((p, i) => (
                      <Tooltip key={p.id} title={p.name}>
                        <Avatar sx={{
                          width: 16, height: 16, bgcolor: p.avatar?.color || glow,
                          fontSize: '0.42rem', fontWeight: 900, border: '1.5px solid rgba(0,0,0,0.3)',
                          ml: i > 0 ? '-4px' : 0
                        }}>
                          {(p.avatar?.initials || p.name?.charAt(0) || '?').slice(0, 2)}
                        </Avatar>
                      </Tooltip>
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: '0.62rem', color: '#8b949e', ml: 0.3 }}>
                    {players.length} playing
                  </Typography>
                </Box>
              </Box>
              <Chip label="LIVE" size="small" sx={{
                height: 16, fontSize: '0.54rem', fontWeight: 900,
                bgcolor: 'rgba(239,35,60,0.12)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.3)',
                animation: 'none'
              }} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
const GAME_TYPE_LABEL = { drawing: 'Drawing', ludo: 'Ludo', snakeladder: 'Snake & Ladder', uno: 'UNO' };

function timeAgo(ts) {
  if (!ts) return '';
  const ms = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : Date.now());
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function PastGamesPanel({ userId }) {
  const [games, setGames] = useStateInner([]);
  const [loading, setLoading] = useStateInner(true);
  const [expanded, setExpanded] = useStateInner(false);
  const [openId, setOpenId] = useStateInner(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    getUserGameHistory(userId, 15).then(data => {
      setGames(data);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return (
    <Box sx={{ mb: 2.5 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1.2}>
        <Typography sx={{ fontSize: '0.88rem' }}>🕹️</Typography>
        <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Past Games</Typography>
      </Box>
      {[0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 0.9, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.04)' }} />)}
    </Box>
  );

  if (games.length === 0) return null;

  const visibleGames = expanded ? games : games.slice(0, 3);

  return (
    <Box sx={{ mb: 2.5 }}>
      {/* Section header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: '0.88rem' }}>🕹️</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Your Past Games
          </Typography>
          <Chip label={games.length} size="small" sx={{ height: 16, minWidth: 22, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(76,201,240,0.14)', color: '#4CC9F0', border: '1px solid rgba(76,201,240,0.28)' }} />
        </Box>
        {games.length > 3 && (
          <Typography onClick={() => setExpanded(e => !e)} sx={{ fontSize: '0.66rem', color: '#4CC9F0', cursor: 'pointer', fontWeight: 700, '&:hover': { opacity: 0.8 } }}>
            {expanded ? 'Show less' : `+${games.length - 3} more`}
          </Typography>
        )}
      </Box>

      <AnimatePresence initial={false}>
        {visibleGames.map((game, i) => {
          const glow = GAME_GLOW[game.gameType] || '#4CC9F0';
          const grad = GAME_GRADIENTS[game.gameType] || GAME_GRADIENTS.drawing;
          const meta = GAME_META[game.gameType] || {};
          const myRank = game.myRank || game.rank || 0;
          const isWin = myRank === 1;
          const isOpen = openId === game.id;
          // Support both new schema (rankedPlayers) and old (opponents)
          const rankedPlayers = game.rankedPlayers || [];
          const hasScores = rankedPlayers.some(p => p.score != null && p.score > 0);
          const winnerName = game.winnerName || game.winner || '';

          return (
            <motion.div key={game.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}>
              <Box
                onClick={() => setOpenId(isOpen ? null : game.id)}
                sx={{
                  border: `1px solid ${glow}${isWin ? '40' : '1a'}`,
                  borderRadius: '16px',
                  background: isWin
                    ? `linear-gradient(135deg, ${glow}10, rgba(14,18,27,0.97))`
                    : 'rgba(255,255,255,0.025)',
                  mb: 0.9, overflow: 'hidden', cursor: 'pointer',
                  boxShadow: isWin ? `0 4px 20px ${glow}14` : 'none',
                  transition: 'border-color 0.15s',
                  '&:hover': { borderColor: `${glow}40` },
                }}
              >
                {/* Top colour bar */}
                <Box sx={{ height: 2, background: grad, opacity: isWin ? 1 : 0.4 }} />

                {/* Main row */}
                <Box display="flex" alignItems="center" gap={1.4} px={1.6} py={1.2}>
                  {/* Game icon */}
                  <Box sx={{
                    width: 38, height: 38, borderRadius: '11px', flexShrink: 0,
                    background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', opacity: isWin ? 1 : 0.7,
                    boxShadow: isWin ? `0 3px 12px ${glow}40` : 'none',
                  }}>
                    {meta.icon || '🎮'}
                  </Box>

                  {/* Centre */}
                  <Box flex={1} minWidth={0}>
                    {/* Game type + rank badge */}
                    <Box display="flex" alignItems="center" gap={0.7} flexWrap="wrap">
                      <Typography sx={{ fontWeight: 900, fontSize: '0.82rem', color: isWin ? glow : '#c9d1d9' }}>
                        {GAME_TYPE_LABEL[game.gameType] || game.gameType}
                      </Typography>
                      <Chip
                        label={`${RANK_MEDAL[myRank] || `#${myRank}`} ${isWin ? 'Winner!' : `${myRank}/${game.totalPlayers}`}`}
                        size="small"
                        sx={{
                          height: 17, fontSize: '0.6rem', fontWeight: 900,
                          bgcolor: isWin ? 'rgba(255,215,0,0.13)' : myRank === 2 ? 'rgba(192,192,192,0.1)' : myRank === 3 ? 'rgba(205,127,50,0.1)' : 'rgba(255,255,255,0.06)',
                          color: isWin ? '#FFD700' : myRank === 2 ? '#C0C0C0' : myRank === 3 ? '#CD7F32' : '#8b949e',
                          border: isWin ? '1px solid rgba(255,215,0,0.32)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      />
                    </Box>

                    {/* Winner summary (only if I didn't win) */}
                    {!isWin && winnerName && (
                      <Typography sx={{ fontSize: '0.63rem', color: '#FFD700', mt: 0.15, fontWeight: 700 }}>
                        🏆 {winnerName} won
                      </Typography>
                    )}

                    {/* Compact player row when collapsed */}
                    {!isOpen && rankedPlayers.length > 0 && (
                      <Box display="flex" alignItems="center" gap={0.4} mt={0.35} flexWrap="wrap">
                        {rankedPlayers.slice(0, 5).map((p, j) => {
                          const hue = [...(p.name || 'x')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
                          const color = `hsl(${hue}, 65%, 55%)`;
                          return (
                            <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.55, py: 0.1, borderRadius: '7px', bgcolor: p.isMe ? `${glow}18` : 'rgba(255,255,255,0.05)', border: p.isMe ? `1px solid ${glow}35` : '1px solid rgba(255,255,255,0.07)' }}>
                              <Typography sx={{ fontSize: '0.58rem' }}>{RANK_MEDAL[p.rank] || `#${p.rank}`}</Typography>
                              <Typography sx={{ fontSize: '0.6rem', fontWeight: p.isMe ? 900 : 600, color: p.isMe ? glow : '#8b949e', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.isMe ? 'You' : p.name}
                              </Typography>
                              {hasScores && p.score != null && (
                                <Typography sx={{ fontSize: '0.58rem', color: '#484f58' }}>{p.score}pt</Typography>
                              )}
                            </Box>
                          );
                        })}
                        {rankedPlayers.length > 5 && <Typography sx={{ fontSize: '0.57rem', color: '#484f58' }}>+{rankedPlayers.length - 5}</Typography>}
                      </Box>
                    )}
                  </Box>

                  {/* Right side: time + chevron */}
                  <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.3} flexShrink={0}>
                    <Typography sx={{ fontSize: '0.6rem', color: '#484f58' }}>{timeAgo(game.playedAt)}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#484f58', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</Typography>
                  </Box>
                </Box>

                {/* Expanded leaderboard */}
                <Collapse in={isOpen}>
                  <Box sx={{ px: 1.6, pb: 1.4, pt: 0.2 }}>
                    <Box sx={{ height: '1px', bgcolor: 'rgba(255,255,255,0.06)', mb: 1.2 }} />
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.8 }}>
                      Final Standings
                    </Typography>
                    {rankedPlayers.map((p, j) => {
                      const hue = [...(p.name || 'x')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
                      const rowColor = `hsl(${hue}, 65%, 55%)`;
                      const isFirst = p.rank === 1;
                      return (
                        <motion.div key={j} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: j * 0.045 }}>
                          <Box display="flex" alignItems="center" gap={1.2} sx={{
                            p: '7px 10px', mb: 0.5, borderRadius: '10px',
                            bgcolor: p.isMe ? `${glow}12` : isFirst ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.03)',
                            border: p.isMe ? `1px solid ${glow}30` : isFirst ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.05)',
                          }}>
                            {/* Medal / rank */}
                            <Typography sx={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>
                              {RANK_MEDAL[p.rank] || `#${p.rank}`}
                            </Typography>
                            {/* Avatar */}
                            <Avatar sx={{ width: 24, height: 24, bgcolor: rowColor, fontSize: '0.55rem', fontWeight: 900, flexShrink: 0 }}>
                              {(p.name || '?').slice(0, 2).toUpperCase()}
                            </Avatar>
                            {/* Name */}
                            <Typography sx={{ flex: 1, fontWeight: p.isMe ? 900 : 700, fontSize: '0.78rem', color: p.isMe ? glow : isFirst ? '#FFD700' : '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.isMe ? `${p.name} (You)` : p.name}
                            </Typography>
                            {/* Score (drawing only) */}
                            {hasScores && p.score != null && (
                              <Chip
                                label={`${p.score} pts`}
                                size="small"
                                sx={{
                                  height: 17, fontSize: '0.6rem', fontWeight: 900, flexShrink: 0,
                                  bgcolor: p.isMe ? `${glow}18` : 'rgba(255,255,255,0.06)',
                                  color: p.isMe ? glow : '#8b949e',
                                  border: p.isMe ? `1px solid ${glow}30` : '1px solid rgba(255,255,255,0.08)',
                                }}
                              />
                            )}
                          </Box>
                        </motion.div>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Box>
  );
}


export function HomeScreen() {
  const { state, logout } = useGameContext();
  const { create, join } = useRoom();
  const playerName = state.playerName;

  const [tab, setTab] = useState('home');
  const [roomCode, setRoomCode] = useState('');
  const [gameType, setGameType] = useState('drawing');
  const [settings, setSettings] = useState({ maxPlayers: 8, rounds: 3, drawTime: 80 });
  const [ludoSettings, setLudoSettings] = useState({ maxPlayers: 4 });
  const [slSettings, setSlSettings] = useState({ maxPlayers: 4 });
  const [unoSettings, setUnoSettings] = useState({ maxPlayers: 6 });
  const [localError, setLocalError] = useState('');
  const [resumeSession, setResumeSession] = useState(getStoredSession);

  const meta = GAME_META[gameType];

  const handleCreate = async () => {
    setLocalError('');
    const gs = gameType === 'ludo' ? ludoSettings
      : gameType === 'snakeladder' ? slSettings
        : gameType === 'uno' ? unoSettings
          : settings;
    await create(playerName, gs, gameType);
  };

  const handleJoin = async () => {
    if (roomCode.length < 6) { setLocalError('Enter valid room code'); return; }
    setLocalError('');
    const ok = await join(roomCode.trim(), playerName);
    if (!ok) setLocalError(state.error || 'Could not join room');
  };

  const handleResume = async ({ roomId }) => {
    setResumeSession(null);
    const ok = await join(roomId, playerName);
    if (!ok) setLocalError(state.error || 'Could not rejoin room');
  };

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#080c12', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', position: 'relative', overflow: 'hidden', pb: 5 }}>
      <BgOrbs />
      <Box sx={{ width: '100%', maxWidth: 460, zIndex: 1, position: 'relative', px: { xs: 1.5, sm: 2 }, pt: { xs: 2, sm: 3.5 } }}>

        {/* Top bar with player name + logout */}
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            <motion.div key="logo" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Player greeting */}
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1.2}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4CC9F0, #7209B7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, color: 'white', fontSize: '1rem',
                    boxShadow: '0 0 14px rgba(76,201,240,0.4)'
                  }}>
                    {playerName?.charAt(0)?.toUpperCase()}
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#484f58', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Playing as</Typography>
                    <Typography sx={{ color: '#4CC9F0', fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.1 }}>{playerName}</Typography>
                    {state.userEmail && (
                      <Typography sx={{ color: '#2a3848', fontSize: '0.56rem', lineHeight: 1.1, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {state.userEmail}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Tooltip title="Sign Out">
                  <IconButton size="small" onClick={logout} sx={{
                    color: '#8b949e', bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', p: 0.7,
                    '&:hover': { color: '#EF233C', borderColor: 'rgba(239,35,60,0.3)' }
                  }}>
                    <LogoutIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Title */}
              <Box textAlign="center" mb={2.5}>
                <Box display="flex" justifyContent="center" gap={1.5} mb={0.8}>
                  {['🎨', '🎲', '🐍'].map((e, i) => (
                    <motion.span key={i} style={{ fontSize: '1.8rem', display: 'inline-block' }}
                      animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.5 }}>
                      {e}
                    </motion.span>
                  ))}
                </Box>
                <Typography sx={{
                  fontFamily: '"Fredoka One", cursive', fontSize: { xs: '2rem', sm: '2.4rem' },
                  background: 'linear-gradient(130deg, #4CC9F0 0%, #F72585 52%, #FFD166 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1
                }}>
                  Celebrations
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resume session banner */}
        {resumeSession && !state.roomId && (
          <ResumeBanner
            onResume={handleResume}
            onDismiss={() => setResumeSession(null)}
          />
        )}

        {/* Main card */}
        <Card sx={{
          mb: 2.5, bgcolor: 'rgba(14,18,27,0.93)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '22px', boxShadow: '0 20px 70px rgba(0,0,0,0.6)'
        }}>
          <CardContent sx={{ p: { xs: '18px', sm: '22px' } }}>
            <AnimatePresence mode="wait">

              {/* HOME */}
              {tab === 'home' && (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button fullWidth variant="contained" size="large" onClick={() => { setLocalError(''); setTab('create'); }}
                        startIcon={<AddCircleIcon />}
                        sx={{
                          py: 1.4, borderRadius: '14px', fontWeight: 900,
                          background: 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)', color: 'white',
                          boxShadow: '0 6px 22px rgba(76,201,240,0.32)',
                          '&:hover': { filter: 'brightness(1.1)' }
                        }}>
                        Create
                      </Button>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button fullWidth variant="outlined" size="large" onClick={() => { setLocalError(''); setTab('join'); }}
                        startIcon={<LoginIcon />}
                        sx={{
                          py: 1.4, borderRadius: '14px', fontWeight: 900,
                          borderColor: 'rgba(247,37,133,0.45)', color: '#F72585',
                          background: 'rgba(247,37,133,0.05)',
                          '&:hover': { borderColor: '#F72585', background: 'rgba(247,37,133,0.11)' }
                        }}>
                        Join
                      </Button>
                    </motion.div>
                  </Box>
                  <Collapse in={!!localError}>
                    <Alert severity="error" sx={{ mt: 1.5, borderRadius: '12px', bgcolor: 'rgba(239,35,60,0.09)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.22)', fontSize: '0.8rem' }}>{localError}</Alert>
                  </Collapse>
                </motion.div>
              )}

              {/* CREATE */}
              {tab === 'create' && (
                <motion.div key="create" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={2.5}>
                    <IconButton size="small" onClick={() => { setTab('home'); setLocalError(''); }}
                      sx={{ color: '#8b949e', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '10px', p: 0.6 }}>
                      <ArrowBackIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#e6edf3' }}>New Room</Typography>
                  </Box>
                  <GameTypePicker selected={gameType} onChange={t => { setGameType(t); setLocalError(''); }} />
                  {gameType === 'drawing' && (<>
                    <SettingSlider label="Max Players" icon="👥" value={settings.maxPlayers} color="#4CC9F0" min={2} max={12} marks={[{ value: 2, label: '2' }, { value: 6, label: '6' }, { value: 12, label: '12' }]} onChange={v => setSettings(s => ({ ...s, maxPlayers: v }))} />
                    <SettingSlider label="Rounds" icon="🔄" value={settings.rounds} color="#F72585" min={1} max={5} marks={[{ value: 1, label: '1' }, { value: 3, label: '3' }, { value: 5, label: '5' }]} onChange={v => setSettings(s => ({ ...s, rounds: v }))} />
                    <SettingSlider label="Draw Time" icon="⏱️" value={settings.drawTime} color="#06D6A0" min={30} max={120} step={10} unit="s" marks={[{ value: 30, label: '30s' }, { value: 80, label: '80s' }, { value: 120, label: '2m' }]} onChange={v => setSettings(s => ({ ...s, drawTime: v }))} />
                  </>)}
                  {gameType === 'ludo' && <SettingSlider label="Players" icon="🎲" value={ludoSettings.maxPlayers} color="#FFD166" min={2} max={4} marks={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]} onChange={v => setLudoSettings(s => ({ ...s, maxPlayers: v }))} />}
                  {gameType === 'snakeladder' && <SettingSlider label="Players" icon="🐍" value={slSettings.maxPlayers} color="#06D6A0" min={2} max={12} marks={[{ value: 2, label: '2' }, { value: 6, label: '6' }, { value: 12, label: '12' }]} onChange={v => setSlSettings(s => ({ ...s, maxPlayers: v }))} />}
                  {gameType === 'uno' && <SettingSlider label="Players" icon="🃏" value={unoSettings.maxPlayers} color="#a855f7" min={2} max={10} marks={[{ value: 2, label: '2' }, { value: 6, label: '6' }, { value: 10, label: '10' }]} onChange={v => setUnoSettings(s => ({ ...s, maxPlayers: v }))} />}
                  <Collapse in={!!localError}>
                    <Alert severity="error" sx={{ mb: 1.5, borderRadius: '12px', bgcolor: 'rgba(239,35,60,0.09)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.22)' }}>{localError}</Alert>
                  </Collapse>
                  <Button fullWidth variant="contained" size="large" onClick={handleCreate} disabled={state.isLoading}
                    startIcon={state.isLoading ? <CircularProgress size={16} color="inherit" /> : <AddCircleIcon />}
                    sx={{
                      py: 1.4, borderRadius: '14px', fontWeight: 900,
                      background: GAME_GRADIENTS[gameType], color: gameType === 'ludo' ? '#1a0800' : 'white',
                      boxShadow: `0 6px 22px ${GAME_GLOW[gameType]}38`, '&:hover': { filter: 'brightness(1.1)' }
                    }}>
                    {state.isLoading ? 'Creating…' : `Create ${meta?.icon} ${meta?.label}`}
                  </Button>
                </motion.div>
              )}

              {/* JOIN */}
              {tab === 'join' && (
                <motion.div key="join" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={2.5}>
                    <IconButton size="small" onClick={() => { setTab('home'); setLocalError(''); }}
                      sx={{ color: '#8b949e', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '10px', p: 0.6 }}>
                      <ArrowBackIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#e6edf3' }}>Join with Code</Typography>
                  </Box>
                  <TextField fullWidth label="Room Code" variant="outlined" value={roomCode}
                    onChange={e => { setRoomCode(e.target.value.toUpperCase()); setLocalError(''); }}
                    inputProps={{ maxLength: 6, style: { letterSpacing: '10px', fontWeight: 900, fontSize: '1.9rem', textAlign: 'center', color: '#F72585', fontFamily: 'monospace' } }}
                    placeholder="——————" onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    InputLabelProps={{ sx: { color: '#484f58' } }}
                    sx={{
                      mb: 2.5, '& .MuiOutlinedInput-root': {
                        borderRadius: '16px', bgcolor: 'rgba(247,37,133,0.035)',
                        '& fieldset': { borderColor: 'rgba(247,37,133,0.2)' },
                        '&:hover fieldset': { borderColor: 'rgba(247,37,133,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: '#F72585', borderWidth: 2 }
                      }
                    }} />
                  <Collapse in={!!localError}>
                    <Alert severity="error" sx={{ mb: 1.5, borderRadius: '12px', bgcolor: 'rgba(239,35,60,0.09)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.22)' }}>{localError}</Alert>
                  </Collapse>
                  <Button fullWidth variant="contained" size="large" onClick={handleJoin} disabled={state.isLoading}
                    startIcon={state.isLoading ? <CircularProgress size={16} color="inherit" /> : <LoginIcon />}
                    sx={{
                      py: 1.4, borderRadius: '14px', fontWeight: 900,
                      background: 'linear-gradient(135deg, #F72585 0%, #7209B7 100%)',
                      boxShadow: '0 6px 22px rgba(247,37,133,0.32)', '&:hover': { filter: 'brightness(1.1)' }
                    }}>
                    {state.isLoading ? 'Joining…' : 'Join Room'}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Open rooms + online users + active games */}
        <AnimatePresence>
          {tab === 'home' && (
            <motion.div key="open-rooms" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.3, delay: 0.1 }}>
              <OnlineUsersStrip />
              <PastGamesPanel userId={state.userId} />
              <ActiveGamesPanel />
              <OpenRoomsPanel setLocalError={setLocalError} />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
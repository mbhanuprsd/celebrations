// src/components/HomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Slider, CircularProgress, Alert, Collapse, IconButton,
  Chip, Avatar, Skeleton, Tooltip, Drawer, Divider,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LoginIcon from '@mui/icons-material/Login';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import GroupIcon from '@mui/icons-material/Group';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import ChatIcon from '@mui/icons-material/Chat';
import PersonIcon from '@mui/icons-material/Person';
import SendIcon from '@mui/icons-material/Send';
import { useRoom } from '../hooks/useRoom';
import { useOpenRooms } from '../hooks/useOpenRooms';
import { useOnlineUsers } from '../hooks/useOnlineUsers';
import { useGameContext } from '../context/GameContext';
import { GAME_META } from '../core/GameEngine';
import {
  listenActiveGames, getUserGameHistory,
  sendGlobalMessage, listenGlobalChat,
} from '../firebase/services';
import { getStoredSession } from '../hooks/useGameSession';
import { ResumeBanner } from './GameSharedUI';

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_GRADIENTS = {
  drawing: 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)',
  ludo: 'linear-gradient(135deg, #FFD166 0%, #EF476F 100%)',
  snakeladder: 'linear-gradient(135deg, #06D6A0 0%, #118AB2 100%)',
  uno: 'linear-gradient(135deg, #DC2626 0%, #7c3aed 100%)',
};
const GAME_GLOW = { drawing: '#4CC9F0', ludo: '#FFD166', snakeladder: '#06D6A0', uno: '#a855f7' };
const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
const GAME_TYPE_LABEL = { drawing: 'Drawing', ludo: 'Ludo', snakeladder: 'Snake & Ladder', uno: 'UNO' };
const NAV_ITEMS = [
  { id: 'games',   label: 'Games',       icon: SportsEsportsIcon, color: '#4CC9F0' },
  { id: 'chat',    label: 'Global Chat', icon: ChatIcon,          color: '#F72585' },
  { id: 'profile', label: 'Profile',     icon: PersonIcon,        color: '#FFD166' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function nameColor(name) {
  const hue = [...(name || 'x')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

// ─── Background ───────────────────────────────────────────────────────────────

function BgOrbs() {
  const orbs = [
    { color: '#4CC9F0', size: 240, top: '2%',  left: '-10%', delay: 0 },
    { color: '#F72585', size: 190, top: '55%',  right: '-8%', delay: 1.5 },
    { color: '#7209B7', size: 160, bottom: '3%', left: '8%',  delay: 0.8 },
    { color: '#FFD166', size: 120, top: '28%',  right: '3%',  delay: 2.2 },
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
        backgroundSize: '36px 36px',
      }} />
    </>
  );
}

// ─── Side Navigation Drawer ───────────────────────────────────────────────────

function SideNav({ open, onClose, activeSection, onSectionChange, playerName, onLogout }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 245,
          bgcolor: 'rgba(8,12,18,0.98)',
          backdropFilter: 'blur(32px)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      ModalProps={{ keepMounted: true }}
    >
      {/* Header */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2.5}>
          <Typography sx={{
            fontFamily: '"Fredoka One", cursive', fontSize: '1.5rem',
            background: 'linear-gradient(130deg, #4CC9F0 0%, #F72585 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1,
          }}>
            Celebrations
          </Typography>
          <IconButton size="small" onClick={onClose}
            sx={{ color: '#484f58', '&:hover': { color: '#e6edf3', bgcolor: 'rgba(255,255,255,0.06)' }, borderRadius: '8px' }}>
            <CloseIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>

        {/* Player card */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          p: '10px 12px', borderRadius: '14px',
          bgcolor: 'rgba(76,201,240,0.07)', border: '1px solid rgba(76,201,240,0.15)',
        }}>
          <Avatar sx={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #4CC9F0, #7209B7)',
            fontWeight: 900, fontSize: '0.85rem', flexShrink: 0,
          }}>
            {playerName?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box minWidth={0}>
            <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: '#4CC9F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {playerName}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 4px #22C55E' }} />
              <Typography sx={{ fontSize: '0.6rem', color: '#484f58', fontWeight: 600 }}>Online</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Nav items */}
      <Box sx={{ flex: 1, px: 1.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
        {NAV_ITEMS.map((item) => {
          const active = activeSection === item.id;
          const Icon = item.icon;
          return (
            <motion.div key={item.id} whileTap={{ scale: 0.97 }}>
              <Box
                onClick={() => { onSectionChange(item.id); onClose(); }}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 1.8, py: 1.3, borderRadius: '14px', cursor: 'pointer',
                  background: active ? `${item.color}14` : 'transparent',
                  border: `1px solid ${active ? item.color + '30' : 'transparent'}`,
                  transition: 'all 0.18s',
                  '&:hover': {
                    background: active ? `${item.color}18` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? item.color + '40' : 'rgba(255,255,255,0.1)'}`,
                  },
                }}
              >
                <Icon sx={{ fontSize: 20, color: active ? item.color : '#484f58', transition: 'color 0.18s' }} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: active ? item.color : '#8b949e', flex: 1, transition: 'color 0.18s' }}>
                  {item.label}
                </Typography>
                {active && (
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                )}
              </Box>
            </motion.div>
          );
        })}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Sign out */}
      <Box sx={{ px: 1.5, py: 1.5 }}>
        <Box
          onClick={onLogout}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 1.8, py: 1.2, borderRadius: '14px', cursor: 'pointer',
            border: '1px solid transparent', transition: 'all 0.18s',
            '&:hover': { background: 'rgba(239,35,60,0.08)', border: '1px solid rgba(239,35,60,0.2)' },
          }}
        >
          <LogoutIcon sx={{ fontSize: 18, color: '#484f58' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#484f58' }}>Sign Out</Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

// ─── Shared Sub-components ────────────────────────────────────────────────────

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
              <Typography sx={{ fontSize: '0.63rem', fontWeight: 900, color: sel ? glow : '#c9d1d9', display: 'block' }}>{meta.label}</Typography>
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
        position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad, borderRadius: '18px 18px 0 0' }} />
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
            background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', boxShadow: `0 4px 12px ${glow}40`,
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
              '&:hover': { filter: 'brightness(1.12)' },
            }}>
            {joining ? <CircularProgress size={12} color="inherit" /> : isFull ? 'Full' : 'Join'}
          </Button>
        </Box>
        {players.length > 0 && (
          <Box display="flex" gap={0.4} mt={1} pl={0.5}>
            {players.slice(0, 9).map((p, i) => (
              <Tooltip key={p.id} title={p.name}>
                <Avatar sx={{ width: 20, height: 20, bgcolor: p.avatar?.color || glow, fontSize: '0.55rem', fontWeight: 900, border: '1.5px solid rgba(0,0,0,0.3)', ml: i > 0 ? '-5px' : 0 }}>
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
          <Typography sx={{ fontWeight: 900, fontSize: '0.76rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Open Rooms</Typography>
          {!loading && rooms.length > 0 && (
            <Chip label={rooms.length} size="small" sx={{ height: 17, minWidth: 22, fontSize: '0.62rem', fontWeight: 900, bgcolor: 'rgba(34,197,94,0.14)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.28)' }} />
          )}
        </Box>
        <Typography sx={{ fontSize: '0.66rem', color: '#484f58' }}>Live</Typography>
      </Box>
      {loading
        ? [0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={88} sx={{ mb: 1.2, borderRadius: '18px', bgcolor: 'rgba(255,255,255,0.04)' }} />)
        : rooms.length === 0
          ? (
            <Box sx={{ textAlign: 'center', py: 4, borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.015)' }}>
              <Typography sx={{ fontSize: '2rem', mb: 0.5 }}>🎮</Typography>
              <Typography sx={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 700 }}>No open rooms right now</Typography>
              <Typography sx={{ color: '#484f58', fontSize: '0.7rem', mt: 0.3 }}>Create one and invite friends!</Typography>
            </Box>
          )
          : (
            <AnimatePresence>
              {rooms.map((room, i) => (
                <motion.div key={room.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <OpenRoomCard room={room} setLocalError={setLocalError} />
                </motion.div>
              ))}
            </AnimatePresence>
          )
      }
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
        <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Online Now</Typography>
        <Chip label={count} size="small" sx={{ height: 16, minWidth: 22, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(34,197,94,0.14)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.28)' }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {users.map((u) => {
          const initials = (u.name || '?').slice(0, 2).toUpperCase();
          const color = nameColor(u.name);
          return (
            <Tooltip key={u.uid} title={u.name}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.35, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${color}30`, cursor: 'default' }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar sx={{ width: 18, height: 18, bgcolor: color, fontSize: '0.5rem', fontWeight: 900 }}>{initials}</Avatar>
                  <Box sx={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E', border: '1.5px solid #080c12' }} />
                </Box>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#c9d1d9', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

function ActiveGamesPanel() {
  const [games, setGames] = useState([]);
  useEffect(() => {
    const unsub = listenActiveGames(setGames);
    return unsub;
  }, []);
  if (games.length === 0) return null;
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1.2}>
        <Typography sx={{ fontSize: '0.9rem' }}>🎮</Typography>
        <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Games</Typography>
        <Chip label={games.length} size="small" sx={{ height: 16, minWidth: 22, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(247,37,133,0.14)', color: '#F72585', border: '1px solid rgba(247,37,133,0.28)' }} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {games.map((room) => {
          const meta = GAME_META[room.gameType] || GAME_META.drawing;
          const glow = GAME_GLOW[room.gameType] || '#4CC9F0';
          const grad = GAME_GRADIENTS[room.gameType] || GAME_GRADIENTS.drawing;
          const players = Object.values(room.players || {});
          return (
            <Box key={room.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, border: `1px solid ${glow}20`, borderRadius: '14px', background: `linear-gradient(135deg, ${glow}06, rgba(14,18,27,0.9))`, p: '10px 14px', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: grad, borderRadius: '14px 0 0 14px' }} />
              <Box sx={{ width: 32, height: 32, borderRadius: '10px', flexShrink: 0, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: `0 3px 10px ${glow}35` }}>{meta.icon}</Box>
              <Box flex={1} minWidth={0}>
                <Box display="flex" alignItems="center" gap={0.6}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: glow, fontFamily: 'monospace', letterSpacing: '2px' }}>{room.id}</Typography>
                  <Chip label={meta.label} size="small" sx={{ height: 14, fontSize: '0.54rem', fontWeight: 800, background: `${glow}20`, color: glow, border: `1px solid ${glow}35` }} />
                </Box>
                <Box display="flex" alignItems="center" gap={0.4} mt={0.2}>
                  <Box sx={{ display: 'flex' }}>
                    {players.slice(0, 6).map((p, i) => (
                      <Tooltip key={p.id} title={p.name}>
                        <Avatar sx={{ width: 16, height: 16, bgcolor: p.avatar?.color || glow, fontSize: '0.42rem', fontWeight: 900, border: '1.5px solid rgba(0,0,0,0.3)', ml: i > 0 ? '-4px' : 0 }}>
                          {(p.avatar?.initials || p.name?.charAt(0) || '?').slice(0, 2)}
                        </Avatar>
                      </Tooltip>
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: '0.62rem', color: '#8b949e', ml: 0.3 }}>{players.length} playing</Typography>
                </Box>
              </Box>
              <Chip label="LIVE" size="small" sx={{ height: 16, fontSize: '0.54rem', fontWeight: 900, bgcolor: 'rgba(239,35,60,0.12)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.3)' }} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── Games Panel ──────────────────────────────────────────────────────────────

function GamesPanel({ playerName, onLocalError, localError }) {
  const { state } = useGameContext();
  const { create, join } = useRoom();
  const [tab, setTab] = useState('home');
  const [roomCode, setRoomCode] = useState('');
  const [gameType, setGameType] = useState('drawing');
  const [settings, setSettings] = useState({ maxPlayers: 8, rounds: 3, drawTime: 80 });
  const [ludoSettings, setLudoSettings] = useState({ maxPlayers: 4 });
  const [slSettings, setSlSettings] = useState({ maxPlayers: 4 });
  const [unoSettings, setUnoSettings] = useState({ maxPlayers: 6 });
  const [resumeSession, setResumeSession] = useState(getStoredSession);
  const meta = GAME_META[gameType];

  const handleCreate = async () => {
    onLocalError('');
    const gs = gameType === 'ludo' ? ludoSettings
      : gameType === 'snakeladder' ? slSettings
        : gameType === 'uno' ? unoSettings
          : settings;
    await create(playerName, gs, gameType);
  };

  const handleJoin = async () => {
    if (roomCode.length < 6) { onLocalError('Enter valid room code'); return; }
    onLocalError('');
    const ok = await join(roomCode.trim(), playerName);
    if (!ok) onLocalError(state.error || 'Could not join room');
  };

  const handleResume = async ({ roomId }) => {
    setResumeSession(null);
    const ok = await join(roomId, playerName);
    if (!ok) onLocalError(state.error || 'Could not rejoin room');
  };

  return (
    <Box>
      {resumeSession && !state.roomId && (
        <ResumeBanner onResume={handleResume} onDismiss={() => setResumeSession(null)} />
      )}
      <Card sx={{ mb: 2.5, bgcolor: 'rgba(14,18,27,0.93)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '22px', boxShadow: '0 20px 70px rgba(0,0,0,0.6)' }}>
        <CardContent sx={{ p: { xs: '18px', sm: '22px' } }}>
          <AnimatePresence mode="wait">
            {tab === 'home' && (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button fullWidth variant="contained" size="large"
                      onClick={() => { onLocalError(''); setTab('create'); }}
                      startIcon={<AddCircleIcon />}
                      sx={{ py: 1.4, borderRadius: '14px', fontWeight: 900, background: 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)', color: 'white', boxShadow: '0 6px 22px rgba(76,201,240,0.32)', '&:hover': { filter: 'brightness(1.1)' } }}>
                      Create
                    </Button>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button fullWidth variant="outlined" size="large"
                      onClick={() => { onLocalError(''); setTab('join'); }}
                      startIcon={<LoginIcon />}
                      sx={{ py: 1.4, borderRadius: '14px', fontWeight: 900, borderColor: 'rgba(247,37,133,0.45)', color: '#F72585', background: 'rgba(247,37,133,0.05)', '&:hover': { borderColor: '#F72585', background: 'rgba(247,37,133,0.11)' } }}>
                      Join
                    </Button>
                  </motion.div>
                </Box>
                <Collapse in={!!localError}>
                  <Alert severity="error" sx={{ mt: 1.5, borderRadius: '12px', bgcolor: 'rgba(239,35,60,0.09)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.22)', fontSize: '0.8rem' }}>{localError}</Alert>
                </Collapse>
              </motion.div>
            )}

            {tab === 'create' && (
              <motion.div key="create" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2.5}>
                  <IconButton size="small" onClick={() => { setTab('home'); onLocalError(''); }}
                    sx={{ color: '#8b949e', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '10px', p: 0.6 }}>
                    <ArrowBackIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#e6edf3' }}>New Room</Typography>
                </Box>
                <GameTypePicker selected={gameType} onChange={t => { setGameType(t); onLocalError(''); }} />
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
                  sx={{ py: 1.4, borderRadius: '14px', fontWeight: 900, background: GAME_GRADIENTS[gameType], color: gameType === 'ludo' ? '#1a0800' : 'white', boxShadow: `0 6px 22px ${GAME_GLOW[gameType]}38`, '&:hover': { filter: 'brightness(1.1)' } }}>
                  {state.isLoading ? 'Creating…' : `Create ${meta?.icon} ${meta?.label}`}
                </Button>
              </motion.div>
            )}

            {tab === 'join' && (
              <motion.div key="join" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2.5}>
                  <IconButton size="small" onClick={() => { setTab('home'); onLocalError(''); }}
                    sx={{ color: '#8b949e', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '10px', p: 0.6 }}>
                    <ArrowBackIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#e6edf3' }}>Join with Code</Typography>
                </Box>
                <TextField fullWidth label="Room Code" variant="outlined" value={roomCode}
                  onChange={e => { setRoomCode(e.target.value.toUpperCase()); onLocalError(''); }}
                  inputProps={{ maxLength: 6, style: { letterSpacing: '10px', fontWeight: 900, fontSize: '1.9rem', textAlign: 'center', color: '#F72585', fontFamily: 'monospace' } }}
                  placeholder="——————" onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  InputLabelProps={{ sx: { color: '#484f58' } }}
                  sx={{
                    mb: 2.5, '& .MuiOutlinedInput-root': {
                      borderRadius: '16px', bgcolor: 'rgba(247,37,133,0.035)',
                      '& fieldset': { borderColor: 'rgba(247,37,133,0.2)' },
                      '&:hover fieldset': { borderColor: 'rgba(247,37,133,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: '#F72585', borderWidth: 2 },
                    },
                  }} />
                <Collapse in={!!localError}>
                  <Alert severity="error" sx={{ mb: 1.5, borderRadius: '12px', bgcolor: 'rgba(239,35,60,0.09)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.22)' }}>{localError}</Alert>
                </Collapse>
                <Button fullWidth variant="contained" size="large" onClick={handleJoin} disabled={state.isLoading}
                  startIcon={state.isLoading ? <CircularProgress size={16} color="inherit" /> : <LoginIcon />}
                  sx={{ py: 1.4, borderRadius: '14px', fontWeight: 900, background: 'linear-gradient(135deg, #F72585 0%, #7209B7 100%)', boxShadow: '0 6px 22px rgba(247,37,133,0.32)', '&:hover': { filter: 'brightness(1.1)' } }}>
                  {state.isLoading ? 'Joining…' : 'Join Room'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <OnlineUsersStrip />
      <ActiveGamesPanel />
      <OpenRoomsPanel setLocalError={onLocalError} />
    </Box>
  );
}

// ─── Global Chat Panel ────────────────────────────────────────────────────────

// ── helpers used only inside chat ──────────────────────────────────────────
function getDateLabel(ts) {
  if (!ts) return null;
  const ms   = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : null);
  if (!ms) return null;
  const d    = new Date(ms);
  const now  = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function isSameDay(tsA, tsB) {
  const toMs = t => t?.toMillis ? t.toMillis() : (typeof t === 'number' ? t : null);
  const a = toMs(tsA), b = toMs(tsB);
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function ChatTick({ double = false, read = false }) {
  const color = read ? '#4CC9F0' : 'rgba(255,255,255,0.55)';
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.4, verticalAlign: 'middle' }}>
      <svg width={double ? 16 : 10} height={10} viewBox={double ? '0 0 16 10' : '0 0 10 10'}>
        <polyline points="1,5 4,8 9,1" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {double && <polyline points="7,5 10,8 15,1" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </Box>
  );
}

function GlobalChatPanel({ userId, playerName }) {
  const [messages, setMessages]   = useState([]);
  const [input,    setInput]      = useState('');
  const [sending,  setSending]    = useState(false);
  const { count: onlineCount }    = useOnlineUsers();
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    const unsub = listenGlobalChat(setMessages);
    return unsub;
  }, []);

  // Scroll to bottom on new messages, but only if already near bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    inputRef.current?.focus();
    try { await sendGlobalMessage(userId, playerName, text); }
    catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const ms = ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : Date.now());
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Pre-process: figure out first/last of each run for tail rendering
  const processed = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const isFirstOfRun = !prev || prev.userId !== msg.userId || !isSameDay(prev.timestamp, msg.timestamp);
    const isLastOfRun  = !next || next.userId !== msg.userId || !isSameDay(next.timestamp, msg.timestamp);
    const showDateSep  = !prev || !isSameDay(prev.timestamp, msg.timestamp);
    return { ...msg, isFirstOfRun, isLastOfRun, showDateSep };
  });

  return (
    // Full-height container that bleeds to page edges (negative mx to cancel parent padding)
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100dvh - 80px)',
      mx: { xs: -1.5, sm: -2 },       // cancel parent horizontal padding
      borderRadius: '0 0 22px 22px',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* ── WhatsApp-style header bar ───────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.2,
        px: 2, py: 1.2,
        background: 'rgba(14,18,27,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        zIndex: 2,
      }}>
        {/* Group avatar */}
        <Box sx={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #F72585 0%, #7209B7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 2px rgba(247,37,133,0.3)',
          fontSize: '1.2rem',
        }}>
          🌐
        </Box>

        {/* Name + online */}
        <Box flex={1} minWidth={0}>
          <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: '#e6edf3', lineHeight: 1.2 }}>
            Global Chat
          </Typography>
          <Box display="flex" alignItems="center" gap={0.6}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 5px #22C55E' }} />
            </motion.div>
            <Typography sx={{ fontSize: '0.65rem', color: '#22C55E', fontWeight: 700 }}>
              {onlineCount} online
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Chat wallpaper + messages ────────────────────────────────────── */}
      <Box sx={{
        flex: 1, overflowY: 'auto', position: 'relative',
        // subtle dot-grid wallpaper like WhatsApp
        bgcolor: '#0a0f1a',
        backgroundImage: [
          'radial-gradient(circle, rgba(76,201,240,0.06) 1px, transparent 1px)',
        ].join(','),
        backgroundSize: '22px 22px',
        px: 1.5, py: 1,
        '&::-webkit-scrollbar': { width: 3 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2 },
      }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.2, opacity: 0.45 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F72585, #7209B7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem',
            }}>💬</Box>
            <Typography sx={{ color: '#8b949e', fontSize: '0.85rem', fontWeight: 800 }}>No messages yet</Typography>
            <Typography sx={{ color: '#484f58', fontSize: '0.72rem' }}>Be the first to say hello 👋</Typography>
          </Box>
        )}

        {/* Messages */}
        {processed.map((msg) => {
          const mine  = msg.userId === userId;
          const color = nameColor(msg.name);

          return (
            <React.Fragment key={msg.id}>
              {/* Date separator pill */}
              {msg.showDateSep && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 1.5 }}>
                  <Box sx={{
                    px: 1.6, py: 0.35, borderRadius: '12px',
                    bgcolor: 'rgba(14,18,27,0.82)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#8b949e', letterSpacing: '0.04em' }}>
                      {getDateLabel(msg.timestamp)}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Row */}
              <Box sx={{
                display: 'flex',
                flexDirection: mine ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 0.7,
                mb: msg.isLastOfRun ? 0.9 : 0.25,
                px: 0.5,
              }}>
                {/* Avatar — only show at end of other's run */}
                {!mine && (
                  <Box sx={{ width: 28, flexShrink: 0, alignSelf: 'flex-end', mb: 0.25 }}>
                    {msg.isLastOfRun ? (
                      <Avatar sx={{ width: 28, height: 28, bgcolor: color, fontSize: '0.6rem', fontWeight: 900, boxShadow: `0 0 0 2px ${color}30` }}>
                        {(msg.name || '?').slice(0, 2).toUpperCase()}
                      </Avatar>
                    ) : null}
                  </Box>
                )}

                {/* Bubble */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                  style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}
                >
                  {/* Sender name (first of their run, not mine) */}
                  {!mine && msg.isFirstOfRun && (
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, color, mb: 0.3, ml: 1.2 }}>
                      {msg.name}
                    </Typography>
                  )}

                  {/* The bubble itself */}
                  <Box sx={{
                    position: 'relative',
                    px: 1.3, pt: 0.75, pb: 0.5,
                    borderRadius: mine
                      ? msg.isLastOfRun ? '18px 18px 4px 18px' : '18px'
                      : msg.isLastOfRun ? '18px 18px 18px 4px' : '18px',

                    // Mine: themed gradient; others: dark card
                    background: mine
                      ? 'linear-gradient(135deg, #1a5f7a 0%, #2d1b69 100%)'
                      : 'rgba(22,28,40,0.95)',
                    border: mine
                      ? '1px solid rgba(76,201,240,0.25)'
                      : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: mine
                      ? '0 2px 12px rgba(76,201,240,0.15)'
                      : '0 2px 8px rgba(0,0,0,0.3)',

                    // Tail using CSS clip on the last bubble of a run
                    ...(msg.isLastOfRun && mine && {
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 0,
                        right: -6,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 0 10px 8px',
                        borderColor: 'transparent transparent rgba(76,201,240,0.25) transparent',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        bottom: 1,
                        right: -5,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 0 9px 7px',
                        borderColor: 'transparent transparent #2d1b69 transparent',
                        zIndex: 1,
                      },
                    }),
                    ...(msg.isLastOfRun && !mine && {
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 0,
                        left: -6,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 8px 10px 0',
                        borderColor: 'transparent rgba(255,255,255,0.08) transparent transparent',
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        bottom: 1,
                        left: -4,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 6px 9px 0',
                        borderColor: 'transparent rgba(22,28,40,0.95) transparent transparent',
                        zIndex: 1,
                      },
                    }),
                  }}>
                    {/* Message text */}
                    <Typography sx={{
                      fontSize: '0.87rem', fontWeight: 500, lineHeight: 1.5,
                      color: mine ? '#dff3fb' : '#c9d1d9',
                      wordBreak: 'break-word',
                      pr: 5,  // space for timestamp
                    }}>
                      {msg.text}
                    </Typography>

                    {/* Timestamp + tick — bottom right inside bubble */}
                    <Box sx={{
                      position: 'absolute', bottom: 5, right: 9,
                      display: 'flex', alignItems: 'center', gap: 0.3,
                    }}>
                      <Typography sx={{ fontSize: '0.58rem', color: mine ? 'rgba(223,243,251,0.5)' : 'rgba(139,148,158,0.7)', lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {formatTime(msg.timestamp)}
                      </Typography>
                      {mine && <ChatTick double read />}
                    </Box>
                  </Box>
                </motion.div>
              </Box>
            </React.Fragment>
          );
        })}

        <div ref={bottomRef} />
      </Box>

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-end', gap: 1,
        px: 1.5, py: 1.2,
        background: 'rgba(14,18,27,0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        {/* Text input — pill-shaped like WhatsApp */}
        <Box sx={{
          flex: 1, display: 'flex', alignItems: 'flex-end',
          bgcolor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          px: 1.8, py: 0.6,
          transition: 'border-color 0.2s',
          '&:focus-within': { borderColor: 'rgba(247,37,133,0.5)' },
        }}>
          <TextField
            inputRef={inputRef}
            fullWidth multiline maxRows={4}
            placeholder="Type a message…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            inputProps={{ maxLength: 300 }}
            variant="standard"
            sx={{
              '& .MuiInputBase-root': {
                color: '#e6edf3', fontSize: '0.9rem', lineHeight: 1.5,
                '&:before': { display: 'none' },
                '&:after':  { display: 'none' },
              },
              '& .MuiInputBase-input::placeholder': { color: '#484f58', opacity: 1 },
            }}
          />
        </Box>

        {/* Send button */}
        <motion.div whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.05 }}>
          <Box
            onClick={handleSend}
            sx={{
              width: 46, height: 46, flexShrink: 0, borderRadius: '50%',
              background: input.trim()
                ? 'linear-gradient(135deg, #F72585 0%, #7209B7 100%)'
                : 'rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() ? 'pointer' : 'default',
              boxShadow: input.trim() ? '0 4px 18px rgba(247,37,133,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {sending
              ? <CircularProgress size={18} sx={{ color: 'rgba(255,255,255,0.6)' }} />
              : <SendIcon sx={{ fontSize: 19, color: input.trim() ? 'white' : '#484f58', ml: '2px', transition: 'color 0.2s' }} />
            }
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────

function PastGamesSection({ userId }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    getUserGameHistory(userId, 15).then(data => { setGames(data); setLoading(false); });
  }, [userId]);

  if (loading) return (
    <Box sx={{ mb: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1.2}>
        <Typography sx={{ fontSize: '0.88rem' }}>🕹️</Typography>
        <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Past Games</Typography>
      </Box>
      {[0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 0.9, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.04)' }} />)}
    </Box>
  );

  if (games.length === 0) return (
    <Box sx={{ textAlign: 'center', py: 5, borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.08)' }}>
      <Typography sx={{ fontSize: '2rem', mb: 0.5 }}>🎮</Typography>
      <Typography sx={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 700 }}>No games played yet</Typography>
      <Typography sx={{ color: '#484f58', fontSize: '0.7rem', mt: 0.3 }}>Join a room to start playing!</Typography>
    </Box>
  );

  const visible = expanded ? games : games.slice(0, 3);

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: '0.88rem' }}>🕹️</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '0.72rem', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Past Games</Typography>
          <Chip label={games.length} size="small" sx={{ height: 16, minWidth: 22, fontSize: '0.6rem', fontWeight: 900, bgcolor: 'rgba(76,201,240,0.14)', color: '#4CC9F0', border: '1px solid rgba(76,201,240,0.28)' }} />
        </Box>
        {games.length > 3 && (
          <Typography onClick={() => setExpanded(e => !e)} sx={{ fontSize: '0.66rem', color: '#4CC9F0', cursor: 'pointer', fontWeight: 700, '&:hover': { opacity: 0.8 } }}>
            {expanded ? 'Show less' : `+${games.length - 3} more`}
          </Typography>
        )}
      </Box>
      <AnimatePresence initial={false}>
        {visible.map((game, i) => {
          const glow = GAME_GLOW[game.gameType] || '#4CC9F0';
          const grad = GAME_GRADIENTS[game.gameType] || GAME_GRADIENTS.drawing;
          const meta = GAME_META[game.gameType] || {};
          const myRank = game.myRank || game.rank || 0;
          const isWin = myRank === 1;
          const isOpen = openId === game.id;
          const rankedPlayers = game.rankedPlayers || [];
          const hasScores = rankedPlayers.some(p => p.score != null && p.score > 0);
          const winnerName = game.winnerName || game.winner || '';
          return (
            <motion.div key={game.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}>
              <Box
                onClick={() => setOpenId(isOpen ? null : game.id)}
                sx={{
                  border: `1px solid ${glow}${isWin ? '40' : '1a'}`, borderRadius: '16px',
                  background: isWin ? `linear-gradient(135deg, ${glow}10, rgba(14,18,27,0.97))` : 'rgba(255,255,255,0.025)',
                  mb: 0.9, overflow: 'hidden', cursor: 'pointer',
                  boxShadow: isWin ? `0 4px 20px ${glow}14` : 'none',
                  '&:hover': { borderColor: `${glow}40` }, transition: 'border-color 0.15s',
                }}
              >
                <Box sx={{ height: 2, background: grad, opacity: isWin ? 1 : 0.4 }} />
                <Box display="flex" alignItems="center" gap={1.4} px={1.6} py={1.2}>
                  <Box sx={{ width: 38, height: 38, borderRadius: '11px', flexShrink: 0, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', opacity: isWin ? 1 : 0.7, boxShadow: isWin ? `0 3px 12px ${glow}40` : 'none' }}>
                    {meta.icon || '🎮'}
                  </Box>
                  <Box flex={1} minWidth={0}>
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
                    {!isWin && winnerName && <Typography sx={{ fontSize: '0.63rem', color: '#FFD700', mt: 0.15, fontWeight: 700 }}>🏆 {winnerName} won</Typography>}
                    {!isOpen && rankedPlayers.length > 0 && (
                      <Box display="flex" alignItems="center" gap={0.4} mt={0.35} flexWrap="wrap">
                        {rankedPlayers.slice(0, 5).map((p, j) => (
                          <Box key={j} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.55, py: 0.1, borderRadius: '7px', bgcolor: p.isMe ? `${glow}18` : 'rgba(255,255,255,0.05)', border: p.isMe ? `1px solid ${glow}35` : '1px solid rgba(255,255,255,0.07)' }}>
                            <Typography sx={{ fontSize: '0.58rem' }}>{RANK_MEDAL[p.rank] || `#${p.rank}`}</Typography>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: p.isMe ? 900 : 600, color: p.isMe ? glow : '#8b949e', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.isMe ? 'You' : p.name}
                            </Typography>
                            {hasScores && p.score != null && <Typography sx={{ fontSize: '0.58rem', color: '#484f58' }}>{p.score}pt</Typography>}
                          </Box>
                        ))}
                        {rankedPlayers.length > 5 && <Typography sx={{ fontSize: '0.57rem', color: '#484f58' }}>+{rankedPlayers.length - 5}</Typography>}
                      </Box>
                    )}
                  </Box>
                  <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.3} flexShrink={0}>
                    <Typography sx={{ fontSize: '0.6rem', color: '#484f58' }}>{timeAgo(game.playedAt)}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#484f58', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</Typography>
                  </Box>
                </Box>
                <Collapse in={isOpen}>
                  <Box sx={{ px: 1.6, pb: 1.4, pt: 0.2 }}>
                    <Box sx={{ height: '1px', bgcolor: 'rgba(255,255,255,0.06)', mb: 1.2 }} />
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.8 }}>Final Standings</Typography>
                    {rankedPlayers.map((p, j) => {
                      const rowColor = nameColor(p.name);
                      const isFirst = p.rank === 1;
                      return (
                        <motion.div key={j} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: j * 0.045 }}>
                          <Box display="flex" alignItems="center" gap={1.2} sx={{ p: '7px 10px', mb: 0.5, borderRadius: '10px', bgcolor: p.isMe ? `${glow}12` : isFirst ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.03)', border: p.isMe ? `1px solid ${glow}30` : isFirst ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,255,255,0.05)' }}>
                            <Typography sx={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>{RANK_MEDAL[p.rank] || `#${p.rank}`}</Typography>
                            <Avatar sx={{ width: 24, height: 24, bgcolor: rowColor, fontSize: '0.55rem', fontWeight: 900, flexShrink: 0 }}>{(p.name || '?').slice(0, 2).toUpperCase()}</Avatar>
                            <Typography sx={{ flex: 1, fontWeight: p.isMe ? 900 : 700, fontSize: '0.78rem', color: p.isMe ? glow : isFirst ? '#FFD700' : '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.isMe ? `${p.name} (You)` : p.name}
                            </Typography>
                            {hasScores && p.score != null && (
                              <Chip label={`${p.score} pts`} size="small" sx={{ height: 17, fontSize: '0.6rem', fontWeight: 900, flexShrink: 0, bgcolor: p.isMe ? `${glow}18` : 'rgba(255,255,255,0.06)', color: p.isMe ? glow : '#8b949e', border: p.isMe ? `1px solid ${glow}30` : '1px solid rgba(255,255,255,0.08)' }} />
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

function ProfilePanel({ state, updateUsername, logout }) {
  const { playerName, userId, userEmail } = state;
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [stats, setStats] = useState({ played: 0, wins: 0, top3: 0 });

  useEffect(() => {
    if (!userId) return;
    getUserGameHistory(userId, 50).then(games => {
      setStats({
        played: games.length,
        wins:   games.filter(g => (g.myRank || g.rank) === 1).length,
        top3:   games.filter(g => (g.myRank || g.rank) <= 3).length,
      });
    });
  }, [userId]);

  const startEdit = () => { setNameInput(playerName || ''); setNameError(''); setEditingName(true); };
  const cancelEdit = () => { setEditingName(false); setNameError(''); };
  const saveEdit = async () => {
    if (nameInput.trim() === playerName) { cancelEdit(); return; }
    setNameSaving(true); setNameError('');
    try { await updateUsername(nameInput); setEditingName(false); }
    catch (err) { setNameError(err.message || 'Could not update'); }
    finally { setNameSaving(false); }
  };

  const STAT_CARDS = [
    { label: 'Played', value: stats.played, icon: '🎮', color: '#4CC9F0' },
    { label: 'Wins',   value: stats.wins,   icon: '🏆', color: '#FFD700' },
    { label: 'Top 3',  value: stats.top3,   icon: '🎖️', color: '#F72585' },
  ];

  return (
    <Box>
      {/* Card */}
      <Box sx={{
        p: 2.5, mb: 2.5, borderRadius: '22px',
        background: 'rgba(14,18,27,0.93)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 70px rgba(0,0,0,0.6)',
      }}>
        {/* Avatar + name */}
        <Box display="flex" alignItems="center" gap={2} mb={2.5}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar sx={{ width: 58, height: 58, background: 'linear-gradient(135deg, #4CC9F0, #7209B7)', fontWeight: 900, fontSize: '1.4rem', boxShadow: '0 0 24px rgba(76,201,240,0.4)' }}>
              {playerName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box sx={{ position: 'absolute', bottom: 2, right: 2, width: 13, height: 13, borderRadius: '50%', bgcolor: '#22C55E', border: '2.5px solid #080c12', boxShadow: '0 0 6px #22C55E' }} />
          </Box>
          <Box flex={1} minWidth={0}>
            <Typography sx={{ color: '#484f58', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.3 }}>Your Profile</Typography>
            {editingName ? (
              <Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <TextField
                    value={nameInput}
                    onChange={e => { setNameInput(e.target.value); setNameError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    size="small" autoFocus inputProps={{ maxLength: 20 }} error={!!nameError}
                    sx={{
                      width: 140,
                      '& .MuiInputBase-input': { color: '#e6edf3', fontSize: '0.9rem', fontWeight: 700, py: '4px', px: '8px' },
                      '& .MuiOutlinedInput-root': { borderRadius: '8px', '& fieldset': { borderColor: 'rgba(76,201,240,0.4)' }, '&.Mui-focused fieldset': { borderColor: '#4CC9F0' } },
                    }}
                  />
                  <Tooltip title="Save"><span>
                    <IconButton size="small" onClick={saveEdit} disabled={nameSaving} sx={{ color: '#22C55E', p: 0.4, '&:hover': { bgcolor: 'rgba(34,197,94,0.1)' } }}>
                      {nameSaving ? <CircularProgress size={13} sx={{ color: '#22C55E' }} /> : <CheckIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </span></Tooltip>
                  <Tooltip title="Cancel"><span>
                    <IconButton size="small" onClick={cancelEdit} sx={{ color: '#8b949e', p: 0.4, '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span></Tooltip>
                </Box>
                {nameError && <Typography sx={{ color: '#EF233C', fontSize: '0.6rem', mt: 0.4 }}>{nameError}</Typography>}
              </Box>
            ) : (
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography sx={{ color: '#4CC9F0', fontWeight: 900, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{playerName}</Typography>
                <Tooltip title="Edit username">
                  <IconButton size="small" onClick={startEdit} sx={{ color: '#30404f', p: 0.3, '&:hover': { color: '#4CC9F0', bgcolor: 'rgba(76,201,240,0.08)' } }}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            {userEmail && !editingName && (
              <Typography sx={{ color: '#2a3848', fontSize: '0.6rem', mt: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{userEmail}</Typography>
            )}
          </Box>
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, mb: 2.5 }}>
          {STAT_CARDS.map(s => (
            <Box key={s.label} sx={{ textAlign: 'center', p: '10px 8px', borderRadius: '14px', bgcolor: `${s.color}0d`, border: `1px solid ${s.color}22` }}>
              <Typography sx={{ fontSize: '1.1rem', lineHeight: 1.2 }}>{s.icon}</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: s.color, lineHeight: 1.1, mt: 0.2 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.58rem', color: '#484f58', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Sign out */}
        <Button fullWidth variant="outlined" onClick={logout} startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
          sx={{ borderRadius: '12px', fontWeight: 800, fontSize: '0.8rem', borderColor: 'rgba(239,35,60,0.25)', color: '#EF233C', background: 'rgba(239,35,60,0.05)', '&:hover': { borderColor: '#EF233C', background: 'rgba(239,35,60,0.1)' } }}>
          Sign Out
        </Button>
      </Box>

      <PastGamesSection userId={userId} />
    </Box>
  );
}

// ─── Main HomeScreen ───────────────────────────────────────────────────────────

export function HomeScreen() {
  const { state, logout, updateUsername } = useGameContext();
  const { playerName } = state;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('games');
  const [localError, setLocalError] = useState('');

  const SECTION_LABEL = { games: '🎮 Games', chat: '💬 Global Chat', profile: '👤 Profile' };
  const activeMeta = NAV_ITEMS.find(n => n.id === activeSection);

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#080c12', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', position: 'relative', overflow: 'hidden', pb: 5 }}>
      <BgOrbs />

      <SideNav
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        playerName={playerName}
        onLogout={logout}
      />

      <Box sx={{ width: '100%', maxWidth: 460, zIndex: 1, position: 'relative', px: { xs: 1.5, sm: 2 }, pt: { xs: 2, sm: 3 } }}>

        {/* Top bar */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2.5}>
          <Box display="flex" alignItems="center" gap={1.2}>
            {/* Menu toggle */}
            <motion.div whileTap={{ scale: 0.9 }}>
              <IconButton
                onClick={() => setDrawerOpen(true)}
                size="small"
                sx={{
                  color: '#8b949e', bgcolor: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${drawerOpen ? (activeMeta?.color || '#4CC9F0') + '40' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '12px', p: 0.8, transition: 'all 0.2s',
                  '&:hover': { color: activeMeta?.color || '#4CC9F0', borderColor: `${activeMeta?.color || '#4CC9F0'}40` },
                }}
              >
                <MenuIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </motion.div>

            {/* Current section label */}
            <motion.div key={activeSection} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
              <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', color: '#e6edf3' }}>
                {SECTION_LABEL[activeSection]}
              </Typography>
            </motion.div>
          </Box>

          {/* App name */}
          <Typography sx={{
            fontFamily: '"Fredoka One", cursive', fontSize: '1.1rem',
            background: 'linear-gradient(130deg, #4CC9F0 0%, #F72585 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Celebrations
          </Typography>
        </Box>

        {/* Panels */}
        <AnimatePresence mode="wait">
          {activeSection === 'games' && (
            <motion.div key="games" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }}>
              <GamesPanel playerName={playerName} onLocalError={setLocalError} localError={localError} />
            </motion.div>
          )}
          {activeSection === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }}>
              <GlobalChatPanel userId={state.userId} playerName={playerName} />
            </motion.div>
          )}
          {activeSection === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }}>
              <ProfilePanel state={state} updateUsername={updateUsername} logout={logout} />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}

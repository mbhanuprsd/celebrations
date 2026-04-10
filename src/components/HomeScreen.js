// src/components/HomeScreen.js — Mobile-first dark colorful redesign
import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Slider, CircularProgress, Alert, Collapse, IconButton,
  Tooltip, Chip, Avatar, Skeleton,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LoginIcon from '@mui/icons-material/Login';
import GroupIcon from '@mui/icons-material/Group';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useRoom } from '../hooks/useRoom';
import { useOpenRooms } from '../hooks/useOpenRooms';
import { useGameContext } from '../context/GameContext';
import { GAME_META } from '../core/GameEngine';

const GAME_GRADIENTS = {
  drawing:     'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)',
  ludo:        'linear-gradient(135deg, #FFD166 0%, #EF476F 100%)',
  snakeladder: 'linear-gradient(135deg, #06D6A0 0%, #118AB2 100%)',
};
const GAME_GLOW = {
  drawing: '#4CC9F0', ludo: '#FFD166', snakeladder: '#06D6A0',
};

// ─── Animated bg orbs ─────────────────────────────────────────────────────
function BgOrbs() {
  const orbs = [
    { color: '#4CC9F0', size: 260, top: '2%',  left: '-10%', delay: 0 },
    { color: '#F72585', size: 200, top: '55%', right: '-8%', delay: 1.5 },
    { color: '#7209B7', size: 180, bottom:'3%',left: '8%',   delay: 0.8 },
    { color: '#FFD166', size: 130, top: '28%', right: '3%',  delay: 2.2 },
    { color: '#06D6A0', size: 110, top: '42%', left: '42%',  delay: 1 },
  ];
  return (
    <>
      {orbs.map((o, i) => (
        <motion.div key={i} style={{
          position: 'fixed', width: o.size, height: o.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color}22 0%, transparent 70%)`,
          top: o.top, left: o.left, right: o.right, bottom: o.bottom,
          pointerEvents: 'none', zIndex: 0,
        }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.85, 0.4] }}
          transition={{ duration: 5 + i, repeat: Infinity, delay: o.delay }} />
      ))}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(76,201,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(76,201,240,1) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }} />
    </>
  );
}

// ─── Reusable slider block ─────────────────────────────────────────────────
function SettingSlider({ label, icon, value, color, min, max, step = 1, marks, unit = '', onChange }) {
  return (
    <Box sx={{ mb: 2, p: 1.5, bgcolor: `${color}08`, borderRadius: '14px', border: `1px solid ${color}18` }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.8}>
        <Typography sx={{ color: '#8b949e', fontSize: '0.78rem', fontWeight: 700 }}>{icon} {label}</Typography>
        <Typography sx={{ color, fontWeight: 900, fontSize: '1rem' }}>{value}{unit}</Typography>
      </Box>
      <Slider value={value} min={min} max={max} step={step} onChange={(_, v) => onChange(v)} marks={marks}
        sx={{
          color, py: 0.5,
          '& .MuiSlider-thumb': { width: 18, height: 18, boxShadow: `0 0 0 4px ${color}25` },
          '& .MuiSlider-markLabel': { color: '#484f58', fontSize: '0.64rem', fontWeight: 700 },
          '& .MuiSlider-track': { background: `linear-gradient(90deg, ${color}99, ${color})` },
        }} />
    </Box>
  );
}

// ─── Game picker ───────────────────────────────────────────────────────────
function GameTypePicker({ selected, onChange }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2.5 }}>
      {Object.entries(GAME_META).map(([key, meta]) => {
        const sel = selected === key;
        const glow = GAME_GLOW[key] || '#4CC9F0';
        return (
          <motion.div key={key} whileHover={{ y: -3 }} whileTap={{ scale: 0.94 }}>
            <Box onClick={() => onChange(key)} sx={{
              border: sel ? `2px solid ${glow}` : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px', p: 1.2, cursor: 'pointer', textAlign: 'center',
              background: sel ? `${glow}14` : 'rgba(255,255,255,0.025)',
              boxShadow: sel ? `0 0 18px ${glow}40` : 'none',
              transition: 'all 0.18s',
            }}>
              <Typography sx={{ fontSize: '1.6rem', lineHeight: 1.1, mb: 0.25 }}>{meta.icon}</Typography>
              <Typography sx={{ fontSize: '0.63rem', fontWeight: 900, color: sel ? glow : '#c9d1d9', display: 'block', lineHeight: 1.2 }}>
                {meta.label}
              </Typography>
              <Typography sx={{ fontSize: '0.56rem', color: '#484f58' }}>
                {meta.minPlayers}–{meta.maxPlayers}p
              </Typography>
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
}

// ─── Single open room card ─────────────────────────────────────────────────
function OpenRoomCard({ room, playerName, setLocalError }) {
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
    if (!playerName.trim()) { setLocalError('Enter your name first'); return; }
    if (isFull) return;
    setJoining(true);
    const ok = await join(room.id, playerName.trim());
    if (!ok) setLocalError(state.error || 'Could not join');
    setJoining(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
      <Box sx={{
        border: `1px solid ${glow}28`, borderRadius: '18px',
        background: `linear-gradient(135deg, ${glow}07 0%, rgba(14,18,27,0.97) 100%)`,
        p: '14px 16px', mb: 1.2,
        boxShadow: `0 4px 22px ${glow}12`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Accent stripe */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: grad, borderRadius: '18px 18px 0 0' }} />

        <Box display="flex" alignItems="center" gap={1.5}>
          {/* Icon */}
          <Box sx={{
            width: 46, height: 46, borderRadius: '13px', flexShrink: 0,
            background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', boxShadow: `0 4px 14px ${glow}45`,
          }}>{meta.icon}</Box>

          {/* Info */}
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" gap={0.7} flexWrap="wrap">
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem',
                color: glow, letterSpacing: '3px' }}>{room.id}</Typography>
              <Chip label={meta.label} size="small" sx={{
                height: 17, fontSize: '0.57rem', fontWeight: 800,
                background: `${glow}20`, color: glow, border: `1px solid ${glow}35`,
              }} />
            </Box>
            <Box display="flex" alignItems="center" gap={0.5} mt={0.25}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 5px #22C55E', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.69rem', color: '#8b949e',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hostName}'s room
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5} mt={0.4} flexWrap="wrap">
              <Chip icon={<GroupIcon sx={{ fontSize: '10px!important' }} />}
                label={`${players.length}/${maxP}`} size="small"
                sx={{ height: 17, fontSize: '0.59rem', fontWeight: 700,
                  bgcolor: 'rgba(255,255,255,0.05)', color: '#c9d1d9', border: '1px solid rgba(255,255,255,0.09)' }} />
              {isFull ? (
                <Chip label="Full" size="small" sx={{ height: 17, fontSize: '0.57rem', fontWeight: 800,
                  bgcolor: 'rgba(239,35,60,0.12)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.25)' }} />
              ) : (
                <Chip label={`${spots} open`} size="small" sx={{ height: 17, fontSize: '0.57rem', fontWeight: 800,
                  bgcolor: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.28)' }} />
              )}
            </Box>
          </Box>

          {/* Join btn */}
          <Button variant="contained" size="small" onClick={handleJoin}
            disabled={isFull || joining}
            sx={{
              flexShrink: 0, background: isFull ? 'rgba(255,255,255,0.05)' : grad,
              color: isFull ? '#484f58' : (room.gameType === 'ludo' ? '#1a0800' : 'white'),
              fontWeight: 900, fontSize: '0.72rem', borderRadius: '10px',
              px: 1.4, py: 0.7, minWidth: 62,
              boxShadow: isFull ? 'none' : `0 4px 14px ${glow}45`,
              '&:hover': { filter: 'brightness(1.12)' },
            }}>
            {joining ? <CircularProgress size={12} color="inherit" /> : isFull ? 'Full' : 'Join'}
          </Button>
        </Box>

        {/* Player avatar row */}
        {players.length > 0 && (
          <Box display="flex" alignItems="center" gap={0.4} mt={1.2} pl={0.5}>
            {players.slice(0, 9).map((p, i) => (
              <Tooltip key={p.id} title={p.name} placement="top">
                <Avatar sx={{ width: 21, height: 21, bgcolor: p.avatar?.color || glow,
                  fontSize: '0.55rem', fontWeight: 900,
                  border: '1.5px solid rgba(0,0,0,0.35)', ml: i > 0 ? '-5px' : 0 }}>
                  {(p.avatar?.initials || p.name?.charAt(0) || '?').slice(0,2)}
                </Avatar>
              </Tooltip>
            ))}
            {players.length > 9 && (
              <Typography sx={{ fontSize: '0.62rem', color: '#8b949e', ml: 0.5 }}>+{players.length - 9}</Typography>
            )}
          </Box>
        )}
      </Box>
    </motion.div>
  );
}

// ─── Open rooms panel ──────────────────────────────────────────────────────
function OpenRoomsPanel({ playerName, setLocalError }) {
  const { rooms, loading } = useOpenRooms();

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Box display="flex" alignItems="center" gap={1}>
          <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 8px #22C55E' }} />
          </motion.div>
          <Typography sx={{ fontWeight: 900, fontSize: '0.76rem', color: '#c9d1d9',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Open Rooms
          </Typography>
          {!loading && rooms.length > 0 && (
            <Chip label={rooms.length} size="small" sx={{
              height: 17, minWidth: 22, fontSize: '0.62rem', fontWeight: 900,
              bgcolor: 'rgba(34,197,94,0.14)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.28)',
            }} />
          )}
        </Box>
        <Typography sx={{ fontSize: '0.66rem', color: '#484f58' }}>
          Live • auto-updates
        </Typography>
      </Box>

      {loading ? (
        [0, 1, 2].map(i => (
          <Skeleton key={i} variant="rounded" height={90} sx={{ mb: 1.2, borderRadius: '18px',
            bgcolor: 'rgba(255,255,255,0.04)' }} />
        ))
      ) : rooms.length === 0 ? (
        <Box sx={{
          textAlign: 'center', py: 4, borderRadius: '18px',
          border: '1px dashed rgba(255,255,255,0.09)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          <Typography sx={{ fontSize: '2rem', mb: 0.5 }}>🎮</Typography>
          <Typography sx={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 700 }}>
            No open rooms right now
          </Typography>
          <Typography sx={{ color: '#484f58', fontSize: '0.7rem', mt: 0.3 }}>
            Create one and invite friends!
          </Typography>
        </Box>
      ) : (
        <AnimatePresence>
          {rooms.map((room, i) => (
            <motion.div key={room.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}>
              <OpenRoomCard room={room} playerName={playerName} setLocalError={setLocalError} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </Box>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
export function HomeScreen() {
  const { state } = useGameContext();
  const { create, join } = useRoom();

  const [tab, setTab] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameType, setGameType] = useState('drawing');
  const [settings, setSettings]       = useState({ maxPlayers: 8, rounds: 3, drawTime: 80 });
  const [ludoSettings, setLudoSettings] = useState({ maxPlayers: 4 });
  const [slSettings, setSlSettings]   = useState({ maxPlayers: 4 });
  const [localError, setLocalError]   = useState('');

  const meta = GAME_META[gameType];

  const handleCreate = async () => {
    if (!playerName.trim()) { setLocalError('Enter your name'); return; }
    setLocalError('');
    const gs = gameType === 'ludo' ? ludoSettings : gameType === 'snakeladder' ? slSettings : settings;
    await create(playerName.trim(), gs, gameType);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) { setLocalError('Enter your name'); return; }
    if (roomCode.length < 6) { setLocalError('Enter valid room code'); return; }
    setLocalError('');
    const ok = await join(roomCode.trim(), playerName.trim());
    if (!ok) setLocalError(state.error || 'Could not join room');
  };

  const goCreate = () => { if (!playerName.trim()) { setLocalError('Enter your name first'); return; } setLocalError(''); setTab('create'); };
  const goJoin   = () => { if (!playerName.trim()) { setLocalError('Enter your name first'); return; } setLocalError(''); setTab('join'); };

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#080c12',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', pb: 5,
    }}>
      <BgOrbs />

      <Box sx={{
        width: '100%', maxWidth: 460, zIndex: 1, position: 'relative',
        px: { xs: 1.5, sm: 2 }, pt: { xs: 2.5, sm: 4 },
      }}>

        {/* Logo */}
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            <motion.div key="logo" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <Box textAlign="center" mb={3}>
                <Box display="flex" justifyContent="center" gap={1.5} mb={1}>
                  {['🎨', '🎲', '🐍'].map((e, i) => (
                    <motion.span key={i} style={{ fontSize: '2rem', display: 'inline-block' }}
                      animate={{ y: [0, -9, 0], rotate: [0, i % 2 === 0 ? -10 : 10, 0] }}
                      transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.5 }}>
                      {e}
                    </motion.span>
                  ))}
                </Box>
                <Typography sx={{
                  fontFamily: '"Fredoka One", cursive', lineHeight: 1,
                  fontSize: { xs: '2.2rem', sm: '2.6rem' },
                  background: 'linear-gradient(130deg, #4CC9F0 0%, #F72585 52%, #FFD166 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Celebrations
                </Typography>
                <Typography sx={{ color: '#484f58', fontSize: '0.75rem', fontWeight: 700, mt: 0.5 }}>
                  Multiplayer games • Play with friends online
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main card */}
        <Card sx={{
          mb: 2.5, bgcolor: 'rgba(14,18,27,0.93)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '22px',
          boxShadow: '0 20px 70px rgba(0,0,0,0.65)',
        }}>
          <CardContent sx={{ p: { xs: '18px', sm: '22px' } }}>
            <AnimatePresence mode="wait">

              {/* ── HOME ── */}
              {tab === 'home' && (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TextField fullWidth label="Your Name" variant="outlined"
                    value={playerName}
                    onChange={e => { setPlayerName(e.target.value); setLocalError(''); }}
                    inputProps={{ maxLength: 18 }}
                    placeholder="Enter your name to play…"
                    onKeyDown={e => e.key === 'Enter' && goCreate()}
                    InputLabelProps={{ sx: { color: '#484f58' } }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '14px', fontWeight: 700,
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.11)' },
                        '&:hover fieldset': { borderColor: 'rgba(76,201,240,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: '#4CC9F0', borderWidth: 2 },
                      },
                    }} />

                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button fullWidth variant="contained" size="large" onClick={goCreate}
                        startIcon={<AddCircleIcon />}
                        sx={{
                          py: 1.4, borderRadius: '14px', fontWeight: 900,
                          background: 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)',
                          color: 'white', boxShadow: '0 6px 22px rgba(76,201,240,0.32)',
                          '&:hover': { filter: 'brightness(1.1)', boxShadow: '0 8px 28px rgba(76,201,240,0.45)' },
                        }}>
                        Create Room
                      </Button>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button fullWidth variant="outlined" size="large" onClick={goJoin}
                        startIcon={<LoginIcon />}
                        sx={{
                          py: 1.4, borderRadius: '14px', fontWeight: 900,
                          borderColor: 'rgba(247,37,133,0.45)', color: '#F72585',
                          background: 'rgba(247,37,133,0.05)',
                          '&:hover': { borderColor: '#F72585', background: 'rgba(247,37,133,0.11)',
                            boxShadow: '0 6px 20px rgba(247,37,133,0.22)' },
                        }}>
                        Join Code
                      </Button>
                    </motion.div>
                  </Box>

                  <Collapse in={!!localError}>
                    <Alert severity="error" sx={{ mt: 1.5, borderRadius: '12px',
                      bgcolor: 'rgba(239,35,60,0.09)', color: '#EF233C',
                      border: '1px solid rgba(239,35,60,0.22)', fontSize: '0.8rem' }}>
                      {localError}
                    </Alert>
                  </Collapse>
                </motion.div>
              )}

              {/* ── CREATE ── */}
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
                    <SettingSlider label="Max Players" icon="👥" value={settings.maxPlayers} color="#4CC9F0"
                      min={2} max={12} marks={[{value:2,label:'2'},{value:6,label:'6'},{value:12,label:'12'}]}
                      onChange={v => setSettings(s => ({ ...s, maxPlayers: v }))} />
                    <SettingSlider label="Rounds" icon="🔄" value={settings.rounds} color="#F72585"
                      min={1} max={5} marks={[{value:1,label:'1'},{value:3,label:'3'},{value:5,label:'5'}]}
                      onChange={v => setSettings(s => ({ ...s, rounds: v }))} />
                    <SettingSlider label="Draw Time" icon="⏱️" value={settings.drawTime} color="#06D6A0"
                      min={30} max={120} step={10} unit="s"
                      marks={[{value:30,label:'30s'},{value:80,label:'80s'},{value:120,label:'2m'}]}
                      onChange={v => setSettings(s => ({ ...s, drawTime: v }))} />
                  </>)}
                  {gameType === 'ludo' && (
                    <SettingSlider label="Players" icon="🎲" value={ludoSettings.maxPlayers} color="#FFD166"
                      min={2} max={4} marks={[{value:2,label:'2'},{value:3,label:'3'},{value:4,label:'4'}]}
                      onChange={v => setLudoSettings(s => ({ ...s, maxPlayers: v }))} />
                  )}
                  {gameType === 'snakeladder' && (<>
                    <SettingSlider label="Players" icon="🐍" value={slSettings.maxPlayers} color="#06D6A0"
                      min={2} max={12} marks={[{value:2,label:'2'},{value:6,label:'6'},{value:12,label:'12'}]}
                      onChange={v => setSlSettings(s => ({ ...s, maxPlayers: v }))} />
                    <Box sx={{ mb: 2, p: 1.2, bgcolor: 'rgba(6,214,160,0.07)', borderRadius: '12px',
                      border: '1px solid rgba(6,214,160,0.15)', fontSize: '0.72rem', color: '#8b949e' }}>
                      🌈 Each player gets a unique color — supports up to 12 players!
                    </Box>
                  </>)}

                  <Collapse in={!!localError}>
                    <Alert severity="error" sx={{ mb: 1.5, borderRadius: '12px', bgcolor: 'rgba(239,35,60,0.09)',
                      color: '#EF233C', border: '1px solid rgba(239,35,60,0.22)' }}>{localError}</Alert>
                  </Collapse>

                  <Button fullWidth variant="contained" size="large" onClick={handleCreate}
                    disabled={state.isLoading}
                    startIcon={state.isLoading ? <CircularProgress size={16} color="inherit" /> : <AddCircleIcon />}
                    sx={{
                      py: 1.4, borderRadius: '14px', fontWeight: 900,
                      background: GAME_GRADIENTS[gameType] || GAME_GRADIENTS.drawing,
                      color: gameType === 'ludo' ? '#1a0800' : 'white',
                      boxShadow: `0 6px 22px ${GAME_GLOW[gameType] || '#4CC9F0'}38`,
                      '&:hover': { filter: 'brightness(1.1)' },
                    }}>
                    {state.isLoading ? 'Creating…' : `Create ${meta?.icon} ${meta?.label}`}
                  </Button>
                </motion.div>
              )}

              {/* ── JOIN ── */}
              {tab === 'join' && (
                <motion.div key="join" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={2.5}>
                    <IconButton size="small" onClick={() => { setTab('home'); setLocalError(''); }}
                      sx={{ color: '#8b949e', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '10px', p: 0.6 }}>
                      <ArrowBackIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: '#e6edf3' }}>Join with Code</Typography>
                  </Box>

                  <TextField fullWidth label="Room Code" variant="outlined"
                    value={roomCode}
                    onChange={e => { setRoomCode(e.target.value.toUpperCase()); setLocalError(''); }}
                    inputProps={{ maxLength: 6, style: {
                      letterSpacing: '10px', fontWeight: 900, fontSize: '1.9rem',
                      textAlign: 'center', color: '#F72585', fontFamily: 'monospace',
                    }}}
                    placeholder="——————"
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    InputLabelProps={{ sx: { color: '#484f58' } }}
                    sx={{
                      mb: 2.5,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '16px', bgcolor: 'rgba(247,37,133,0.035)',
                        '& fieldset': { borderColor: 'rgba(247,37,133,0.2)' },
                        '&:hover fieldset': { borderColor: 'rgba(247,37,133,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: '#F72585', borderWidth: 2 },
                      },
                    }} />

                  <Collapse in={!!localError}>
                    <Alert severity="error" sx={{ mb: 1.5, borderRadius: '12px', bgcolor: 'rgba(239,35,60,0.09)',
                      color: '#EF233C', border: '1px solid rgba(239,35,60,0.22)' }}>{localError}</Alert>
                  </Collapse>

                  <Button fullWidth variant="contained" size="large" onClick={handleJoin}
                    disabled={state.isLoading}
                    startIcon={state.isLoading ? <CircularProgress size={16} color="inherit" /> : <LoginIcon />}
                    sx={{
                      py: 1.4, borderRadius: '14px', fontWeight: 900,
                      background: 'linear-gradient(135deg, #F72585 0%, #7209B7 100%)',
                      boxShadow: '0 6px 22px rgba(247,37,133,0.32)',
                      '&:hover': { filter: 'brightness(1.1)' },
                    }}>
                    {state.isLoading ? 'Joining…' : 'Join Room'}
                  </Button>
                </motion.div>
              )}

            </AnimatePresence>
          </CardContent>
        </Card>

        {/* ── Open Rooms (home tab only) ── */}
        <AnimatePresence>
          {tab === 'home' && (
            <motion.div key="open-rooms"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.3, delay: 0.12 }}>
              <OpenRoomsPanel playerName={playerName} setLocalError={setLocalError} />
            </motion.div>
          )}
        </AnimatePresence>

      </Box>
      <Typography sx={{ position: 'fixed', bottom: 8, fontSize: '0.65rem', color: '#484f58', zIndex: 1 }}>
        Made with ❤️ by <a href="https://github.com/mbhanuprsd" target="_blank" rel="noopener noreferrer" style={{ color: '#F72585' }}>Bhanu Merakanapalli</a>
      </Typography>
    </Box>
  );
}

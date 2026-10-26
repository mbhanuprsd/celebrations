import React, { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Collapse, IconButton, Slider, Skeleton, TextField, Tooltip, Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GroupIcon from '@mui/icons-material/Group';
import LoginIcon from '@mui/icons-material/Login';
import { useRoom } from '../../hooks/useRoom';
import { useOpenRooms } from '../../hooks/useOpenRooms';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { useGameContext } from '../../context/GameContext';
import { GAME_META } from '../../core/GameEngine';
import { QUIZ_TOPICS } from '../../games/quiz/quizConstants';
import { listenActiveGames } from '../../firebase/services';
import { getStoredSession } from '../../hooks/useGameSession';
import { ResumeBanner } from '../GameSharedUI';
import { GAME_GRADIENTS, GAME_GLOW, nameColor } from './sectionUtils';

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
  const [quizSettings, setQuizSettings] = useState({ maxPlayers: 12, questionCount: 8, topic: 'General Knowledge' });
  const [boggleSettings, setBoggleSettings] = useState({ maxPlayers: 8, minWordLength: 3, roundDuration: 120 });
  const [resumeSession, setResumeSession] = useState(getStoredSession);
  const meta = GAME_META[gameType];

  const handleCreate = async () => {
    onLocalError('');
    if (gameType === 'quiz' && !quizSettings.topic.trim()) {
      onLocalError('Please enter a topic for the quiz.');
      return;
    }

    const gs = gameType === 'ludo' ? ludoSettings
      : gameType === 'snakeladder' ? slSettings
        : gameType === 'uno' ? unoSettings
          : gameType === 'quiz' ? { ...quizSettings, topic: quizSettings.topic.trim() }
            : gameType === 'boggle' ? boggleSettings
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
                {gameType === 'boggle' && (
                  <>
                    <SettingSlider label="Max Players" icon="👥" value={boggleSettings.maxPlayers} color="#06D6A0" min={2} max={12} marks={[{ value: 2, label: '2' }, { value: 8, label: '8' }, { value: 12, label: '12' }]} onChange={v => setBoggleSettings(s => ({ ...s, maxPlayers: v }))} />
                    <SettingSlider label="Minimum Word Length" icon="🔤" value={boggleSettings.minWordLength} color="#3A86FF" min={3} max={6} marks={[{ value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 6, label: '6' }]} onChange={v => setBoggleSettings(s => ({ ...s, minWordLength: v }))} />
                    <SettingSlider label="Round Time" icon="⏱️" value={boggleSettings.roundDuration} color="#FFB703" min={30} max={120} step={30} unit="s" marks={[{ value: 30, label: '30s' }, { value: 60, label: '60s' }, { value: 90, label: '90s' }, { value: 120, label: '120s' }]} onChange={v => setBoggleSettings(s => ({ ...s, roundDuration: v }))} />
                  </>
                )}
                {gameType === 'quiz' && (
                  <Box>
                    <SettingSlider label="Questions" icon="❓" value={quizSettings.questionCount}
                      color="#4CC9F0" min={5} max={15} step={1}
                      marks={[{ value: 5, label: '5' }, { value: 8, label: '8' }, { value: 15, label: '15' }]}
                      onChange={v => setQuizSettings(s => ({ ...s, questionCount: v }))} />
                    <Box sx={{ mt: 2 }}>
                      <Typography sx={{ color: '#8b949e', fontSize: '0.73rem', mb: 1, fontWeight: 700 }}>
                        🎯 Topic
                      </Typography>
                      {/* Free-form topic input */}
                      <TextField
                        fullWidth
                        placeholder="e.g. Indian History, Marvel Movies, Cricket…"
                        value={quizSettings.topic}
                        onChange={e => setQuizSettings(s => ({ ...s, topic: e.target.value }))}
                        inputProps={{ maxLength: 60 }}
                        size="small"
                        sx={{
                          mb: 1.5,
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(255,255,255,0.04)',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            color: '#e6edf3',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                            '&:hover fieldset': { borderColor: '#4CC9F0' },
                            '&.Mui-focused fieldset': { borderColor: '#4CC9F0' },
                          },
                          '& input::placeholder': { color: '#555', opacity: 1 },
                        }}
                      />
                      {/* Quick-pick suggestions */}
                      <Typography sx={{ color: '#555', fontSize: '0.65rem', mb: 0.8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Quick pick
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
                        {QUIZ_TOPICS.map(t => (
                          <Chip key={t.id} label={`${t.icon} ${t.label}`} size="small"
                            onClick={() => setQuizSettings(s => ({ ...s, topic: t.label }))}
                            sx={{
                              cursor: 'pointer', fontWeight: 700, fontSize: '0.67rem',
                              bgcolor: quizSettings.topic === t.label ? `${t.color}28` : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${quizSettings.topic === t.label ? t.color : 'rgba(255,255,255,0.08)'}`,
                              color: quizSettings.topic === t.label ? t.color : '#666',
                              '&:hover': { bgcolor: `${t.color}18`, borderColor: t.color, color: t.color },
                            }} />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                )}
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

export { GamesPanel as ArenaSection };

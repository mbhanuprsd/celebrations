// src/components/HomeScreen.js
import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Divider, Slider, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Collapse, IconButton, Tooltip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import BrushIcon from '@mui/icons-material/Brush';
import GroupIcon from '@mui/icons-material/Group';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LoginIcon from '@mui/icons-material/Login';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useRoom } from '../hooks/useRoom';
import { useGameContext } from '../context/GameContext';

const FloatingShape = ({ style, delay = 0 }) => (
  <motion.div
    style={{
      position: 'absolute', borderRadius: '50%',
      background: 'linear-gradient(135deg, rgba(67,97,238,0.15), rgba(247,37,133,0.1))',
      ...style,
    }}
    animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
    transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
  />
);

export function HomeScreen() {
  const { state } = useGameContext();
  const { create, join } = useRoom();

  const [tab, setTab] = useState('home'); // home | create | join
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [settings, setSettings] = useState({ maxPlayers: 8, rounds: 3, drawTime: 80 });
  const [localError, setLocalError] = useState('');

  const handleCreate = async () => {
    if (!playerName.trim()) { setLocalError('Enter your name'); return; }
    setLocalError('');
    await create(playerName.trim(), settings);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) { setLocalError('Enter your name'); return; }
    if (roomCode.length < 6) { setLocalError('Enter valid room code'); return; }
    setLocalError('');
    const ok = await join(roomCode.trim(), playerName.trim());
    if (!ok) setLocalError(state.error || 'Could not join room');
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F0F4FF 0%, #E8F5FF 50%, #FFF0F8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', p: 2,
    }}>
      {/* Floating decorations */}
      <FloatingShape style={{ width: 200, height: 200, top: '5%', left: '-5%', opacity: 0.5 }} delay={0} />
      <FloatingShape style={{ width: 150, height: 150, bottom: '10%', right: '-3%', opacity: 0.4 }} delay={1.5} />
      <FloatingShape style={{ width: 80, height: 80, top: '30%', right: '8%', opacity: 0.6 }} delay={2.5} />
      <FloatingShape style={{ width: 60, height: 60, bottom: '25%', left: '5%', opacity: 0.5 }} delay={0.8} />

      {/* Pencil emojis floating */}
      {['✏️','🎨','🖌️','🎭','🖍️'].map((e, i) => (
        <motion.div key={i} style={{
          position: 'absolute', fontSize: '2rem', userSelect: 'none',
          left: `${10 + i * 20}%`, top: `${15 + (i % 2) * 60}%`,
          opacity: 0.3,
        }}
          animate={{ y: [0, -15, 0], rotate: [0, 15, -15, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.7 }}
        >
          {e}
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: 480, zIndex: 1 }}
      >
        {/* Logo */}
        <Box textAlign="center" mb={3}>
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-block' }}
          >
            <BrushIcon sx={{ fontSize: 60, color: '#4361EE', filter: 'drop-shadow(0 4px 12px rgba(67,97,238,0.4))' }} />
          </motion.div>
          <Typography variant="h2" sx={{
            fontFamily: '"Fredoka One", cursive',
            background: 'linear-gradient(135deg, #4361EE, #F72585)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1, mt: 1,
          }}>
            Scribbly
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
            Draw it. Guess it. Win it! 🎉
          </Typography>
        </Box>

        <Card elevation={0} sx={{ border: '2px solid rgba(67,97,238,0.1)', borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            {/* Tab switcher */}
            {tab === 'home' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <TextField
                  fullWidth label="Your Name" variant="outlined"
                  value={playerName} onChange={e => setPlayerName(e.target.value)}
                  inputProps={{ maxLength: 18 }}
                  sx={{ mb: 3 }}
                  onKeyDown={e => e.key === 'Enter' && setTab('create')}
                  placeholder="What do people call you? 😄"
                />

                <Button fullWidth variant="contained" color="primary" size="large"
                  startIcon={<AddCircleIcon />}
                  onClick={() => { if (!playerName.trim()) { setLocalError('Enter your name'); return; } setLocalError(''); setTab('create'); }}
                  sx={{ mb: 2, py: 1.5 }}
                >
                  Create Room
                </Button>

                <Button fullWidth variant="outlined" color="primary" size="large"
                  startIcon={<LoginIcon />}
                  onClick={() => { if (!playerName.trim()) { setLocalError('Enter your name'); return; } setLocalError(''); setTab('join'); }}
                  sx={{ py: 1.5 }}
                >
                  Join Room
                </Button>

                <Collapse in={!!localError}>
                  <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{localError}</Alert>
                </Collapse>

                <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.50', borderRadius: 3, border: '1px solid rgba(67,97,238,0.15)' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <InfoOutlinedIcon sx={{ fontSize: 14 }} />
                    2–12 players • Draw & Guess • Up to 5 rounds
                  </Typography>
                </Box>
              </motion.div>
            )}

            {tab === 'create' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Room Settings</Typography>

                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <GroupIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    Max Players: <strong>{settings.maxPlayers}</strong>
                  </Typography>
                  <Slider value={settings.maxPlayers} min={2} max={12} step={1}
                    onChange={(_, v) => setSettings(s => ({ ...s, maxPlayers: v }))}
                    marks={[{value:2,label:'2'},{value:6,label:'6'},{value:12,label:'12'}]}
                    color="primary"
                  />
                </Box>

                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    🔄 Rounds: <strong>{settings.rounds}</strong>
                  </Typography>
                  <Slider value={settings.rounds} min={1} max={5} step={1}
                    onChange={(_, v) => setSettings(s => ({ ...s, rounds: v }))}
                    marks={[{value:1,label:'1'},{value:3,label:'3'},{value:5,label:'5'}]}
                    color="secondary"
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ⏱️ Draw Time: <strong>{settings.drawTime}s</strong>
                  </Typography>
                  <Slider value={settings.drawTime} min={30} max={120} step={10}
                    onChange={(_, v) => setSettings(s => ({ ...s, drawTime: v }))}
                    marks={[{value:30,label:'30s'},{value:80,label:'80s'},{value:120,label:'2min'}]}
                    color="success"
                  />
                </Box>

                <Collapse in={!!localError}>
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{localError}</Alert>
                </Collapse>

                <Box display="flex" gap={1}>
                  <Button variant="outlined" onClick={() => setTab('home')} sx={{ flex: 0 }}>Back</Button>
                  <Button fullWidth variant="contained" color="primary" size="large"
                    onClick={handleCreate} disabled={state.isLoading}
                    startIcon={state.isLoading ? <CircularProgress size={18} color="inherit" /> : <AddCircleIcon />}
                  >
                    {state.isLoading ? 'Creating...' : 'Create!'}
                  </Button>
                </Box>
              </motion.div>
            )}

            {tab === 'join' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Join a Room</Typography>
                <TextField
                  fullWidth label="Room Code" variant="outlined"
                  value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  inputProps={{ maxLength: 6, style: { letterSpacing: '6px', fontWeight: 800, fontSize: '1.4rem', textAlign: 'center' } }}
                  sx={{ mb: 2 }}
                  placeholder="ABC123"
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />

                <Collapse in={!!localError}>
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{localError}</Alert>
                </Collapse>

                <Box display="flex" gap={1}>
                  <Button variant="outlined" onClick={() => setTab('home')} sx={{ flex: 0 }}>Back</Button>
                  <Button fullWidth variant="contained" color="secondary" size="large"
                    onClick={handleJoin} disabled={state.isLoading}
                    startIcon={state.isLoading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
                  >
                    {state.isLoading ? 'Joining...' : 'Join!'}
                  </Button>
                </Box>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}

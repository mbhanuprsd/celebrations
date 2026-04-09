// src/components/HomeScreen.js — Dark mode
import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent,
  Slider, CircularProgress, Alert, Collapse, IconButton, Tooltip, Chip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LoginIcon from '@mui/icons-material/Login';
import GroupIcon from '@mui/icons-material/Group';
import { useRoom } from '../hooks/useRoom';
import { useGameContext } from '../context/GameContext';
import { GAME_META } from '../core/GameEngine';

function GameTypePicker({ selected, onChange }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
      {Object.entries(GAME_META).map(([key, meta]) => (
        <motion.div key={key} style={{ flex: 1 }} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
          <Box onClick={() => onChange(key)} sx={{
            border: selected === key ? '2px solid #4CC9F0' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3, p: 1.5, cursor: 'pointer', textAlign: 'center',
            bgcolor: selected === key ? 'rgba(76,201,240,0.08)' : 'rgba(255,255,255,0.03)',
            boxShadow: selected === key ? '0 0 16px rgba(76,201,240,0.2)' : 'none',
            transition: 'all 0.2s ease',
          }}>
            <Typography sx={{ fontSize: '2rem', lineHeight: 1, mb: 0.5 }}>{meta.icon}</Typography>
            <Typography variant="caption" fontWeight={800} display="block" sx={{ color: selected === key ? '#4CC9F0' : '#e6edf3' }}>
              {meta.label}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8b949e', fontSize: '0.62rem' }}>
              {meta.minPlayers}–{meta.maxPlayers} players
            </Typography>
          </Box>
        </motion.div>
      ))}
    </Box>
  );
}

export function HomeScreen() {
  const { state } = useGameContext();
  const { create, join } = useRoom();
  const [tab, setTab] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameType, setGameType] = useState('drawing');
  const [settings, setSettings] = useState({ maxPlayers: 8, rounds: 3, drawTime: 80 });
  const [ludoSettings, setLudoSettings] = useState({ maxPlayers: 4 });
  const [localError, setLocalError] = useState('');

  const meta = GAME_META[gameType];

  const handleCreate = async () => {
    if (!playerName.trim()) { setLocalError('Enter your name'); return; }
    setLocalError('');
    await create(playerName.trim(), gameType === 'ludo' ? ludoSettings : settings, gameType);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) { setLocalError('Enter your name'); return; }
    if (roomCode.length < 6) { setLocalError('Enter valid room code'); return; }
    setLocalError('');
    const ok = await join(roomCode.trim(), playerName.trim());
    if (!ok) setLocalError(state.error || 'Could not join room');
  };

  const goCreate = () => { if (!playerName.trim()) { setLocalError('Enter your name'); return; } setLocalError(''); setTab('create'); };
  const goJoin   = () => { if (!playerName.trim()) { setLocalError('Enter your name'); return; } setLocalError(''); setTab('join'); };

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', p: 2,
    }}>
      {/* Background grid pattern */}
      <Box sx={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: 'linear-gradient(rgba(76,201,240,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(76,201,240,0.5) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glow orbs */}
      {[
        { top: '10%', left: '15%', color: '#4CC9F0' },
        { bottom: '15%', right: '10%', color: '#F72585' },
        { top: '60%', left: '5%', color: '#7209B7' },
      ].map((o, i) => (
        <motion.div key={i} style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color}20, transparent 70%)`, ...o }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 1.2 }} />
      ))}

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }} style={{ width: '100%', maxWidth: 420, zIndex: 1 }}>

        {/* Logo */}
        <Box textAlign="center" mb={3}>
          {['🎨','🎲'].map((e, i) => (
            <motion.span key={i} style={{ fontSize: '2.2rem', display: 'inline-block', margin: '0 4px' }}
              animate={{ y: [0,-8,0], rotate: [0, i%2===0?-8:8, 0] }}
              transition={{ duration: 2.5 + i*0.5, repeat: Infinity, delay: i * 0.6 }}>
              {e}
            </motion.span>
          ))}
          <Typography variant="h2" sx={{
            fontFamily: '"Fredoka One", cursive',
            background: 'linear-gradient(135deg, #4CC9F0, #F72585)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, mt: 0.5,
          }}>Celebrations</Typography>
          <Typography variant="body2" sx={{ color: '#8b949e', mt: 0.5, fontWeight: 600 }}>
            Win it! 🏆
          </Typography>
        </Box>

        <Card sx={{ bgcolor: '#161b22', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CardContent sx={{ p: 3 }}>
            <AnimatePresence mode="wait">

              {tab === 'home' && (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TextField fullWidth label="Your Name" variant="outlined"
                    value={playerName} onChange={e => setPlayerName(e.target.value)}
                    inputProps={{ maxLength: 18 }} sx={{ mb: 2.5 }}
                    placeholder="Enter your name..."
                    onKeyDown={e => e.key === 'Enter' && goCreate()}
                    InputLabelProps={{ sx: { color: '#8b949e' } }}
                  />
                  <Button fullWidth variant="contained" color="primary" size="large"
                    startIcon={<AddCircleIcon />} sx={{ mb: 1.5, py: 1.4 }} onClick={goCreate}>
                    Create Room
                  </Button>
                  <Button fullWidth variant="outlined" size="large"
                    startIcon={<LoginIcon />} sx={{ py: 1.4, borderColor: 'rgba(255,255,255,0.15)', color: '#e6edf3',
                      '&:hover': { borderColor: '#4CC9F0', color: '#4CC9F0', bgcolor: 'rgba(76,201,240,0.06)' } }}
                    onClick={goJoin}>
                    Join Room
                  </Button>
                  <Collapse in={!!localError}>
                    <Alert severity="error" sx={{ mt: 2, bgcolor: 'rgba(239,35,60,0.1)', color: '#EF233C', border: '1px solid rgba(239,35,60,0.3)', borderRadius: 2 }}>{localError}</Alert>
                  </Collapse>
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" sx={{ color: '#8b949e', display: 'block', textAlign: 'center' }}>
                      🎨 Draw & Guess (2–12) &nbsp;•&nbsp; 🎲 Ludo (2–4)
                    </Typography>
                  </Box>
                </motion.div>
              )}

              {tab === 'create' && (
                <motion.div key="create" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: '#e6edf3' }}>New Room</Typography>
                  <GameTypePicker selected={gameType} onChange={type => { setGameType(type); setLocalError(''); }} />

                  {gameType === 'drawing' && (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ color: '#8b949e', mb: 1 }}>
                          <GroupIcon sx={{ fontSize: 15, mr: 0.5, verticalAlign: 'middle' }} />
                          Max Players: <strong style={{ color: '#4CC9F0' }}>{settings.maxPlayers}</strong>
                        </Typography>
                        <Slider value={settings.maxPlayers} min={2} max={12} step={1}
                          onChange={(_, v) => setSettings(s => ({ ...s, maxPlayers: v }))}
                          marks={[{value:2,label:'2'},{value:6,label:'6'},{value:12,label:'12'}]}
                          sx={{ color: '#4CC9F0', '& .MuiSlider-markLabel': { color: '#8b949e', fontSize: '0.7rem' } }} />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ color: '#8b949e', mb: 1 }}>
                          🔄 Rounds: <strong style={{ color: '#F72585' }}>{settings.rounds}</strong>
                        </Typography>
                        <Slider value={settings.rounds} min={1} max={5} step={1}
                          onChange={(_, v) => setSettings(s => ({ ...s, rounds: v }))}
                          marks={[{value:1,label:'1'},{value:3,label:'3'},{value:5,label:'5'}]}
                          sx={{ color: '#F72585', '& .MuiSlider-markLabel': { color: '#8b949e', fontSize: '0.7rem' } }} />
                      </Box>
                      <Box sx={{ mb: 2.5 }}>
                        <Typography variant="body2" sx={{ color: '#8b949e', mb: 1 }}>
                          ⏱️ Draw Time: <strong style={{ color: '#06D6A0' }}>{settings.drawTime}s</strong>
                        </Typography>
                        <Slider value={settings.drawTime} min={30} max={120} step={10}
                          onChange={(_, v) => setSettings(s => ({ ...s, drawTime: v }))}
                          marks={[{value:30,label:'30s'},{value:80,label:'80s'},{value:120,label:'2m'}]}
                          sx={{ color: '#06D6A0', '& .MuiSlider-markLabel': { color: '#8b949e', fontSize: '0.7rem' } }} />
                      </Box>
                    </>
                  )}
                  {gameType === 'ludo' && (
                    <Box sx={{ mb: 2.5 }}>
                      <Typography variant="body2" sx={{ color: '#8b949e', mb: 1 }}>
                        <GroupIcon sx={{ fontSize: 15, mr: 0.5, verticalAlign: 'middle' }} />
                        Players: <strong style={{ color: '#FFD166' }}>{ludoSettings.maxPlayers}</strong>
                      </Typography>
                      <Slider value={ludoSettings.maxPlayers} min={2} max={4} step={1}
                        onChange={(_, v) => setLudoSettings(s => ({ ...s, maxPlayers: v }))}
                        marks={[{value:2,label:'2'},{value:3,label:'3'},{value:4,label:'4'}]}
                        sx={{ color: '#FFD166', '& .MuiSlider-markLabel': { color: '#8b949e', fontSize: '0.7rem' } }} />
                    </Box>
                  )}

                  <Collapse in={!!localError}><Alert severity="error" sx={{ mb: 2 }}>{localError}</Alert></Collapse>
                  <Box display="flex" gap={1}>
                    <Button variant="outlined" onClick={() => setTab('home')}
                      sx={{ borderColor: 'rgba(255,255,255,0.12)', color: '#8b949e' }}>Back</Button>
                    <Button fullWidth variant="contained" color="primary" size="large"
                      onClick={handleCreate} disabled={state.isLoading}
                      startIcon={state.isLoading ? <CircularProgress size={16} color="inherit" /> : <AddCircleIcon />}
                      sx={{ py: 1.4 }}>
                      {state.isLoading ? 'Creating...' : `Create ${meta?.icon} ${meta?.label}`}
                    </Button>
                  </Box>
                </motion.div>
              )}

              {tab === 'join' && (
                <motion.div key="join" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: '#e6edf3' }}>Join Room</Typography>
                  <TextField fullWidth label="Room Code" variant="outlined"
                    value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    inputProps={{ maxLength: 6, style: { letterSpacing: '8px', fontWeight: 800, fontSize: '1.6rem', textAlign: 'center', color: '#4CC9F0' } }}
                    sx={{ mb: 2.5 }} placeholder="——————"
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    InputLabelProps={{ sx: { color: '#8b949e' } }}
                  />
                  <Collapse in={!!localError}><Alert severity="error" sx={{ mb: 2 }}>{localError}</Alert></Collapse>
                  <Box display="flex" gap={1}>
                    <Button variant="outlined" onClick={() => setTab('home')}
                      sx={{ borderColor: 'rgba(255,255,255,0.12)', color: '#8b949e' }}>Back</Button>
                    <Button fullWidth variant="contained" color="secondary" size="large"
                      onClick={handleJoin} disabled={state.isLoading}
                      startIcon={state.isLoading ? <CircularProgress size={16} color="inherit" /> : <LoginIcon />}
                      sx={{ py: 1.4 }}>
                      {state.isLoading ? 'Joining...' : 'Join!'}
                    </Button>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}

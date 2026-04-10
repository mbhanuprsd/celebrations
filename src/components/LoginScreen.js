// src/components/LoginScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, Button,
  CircularProgress, Alert, Chip,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useGameContext } from '../context/GameContext';
import { checkNameAvailable, listenOnlineUsers } from '../firebase/services';

const ADJECTIVES = ['Swift','Bold','Clever','Lucky','Brave','Witty','Calm','Fierce'];
const NOUNS      = ['Tiger','Fox','Eagle','Panda','Wolf','Shark','Lynx','Bear'];
const randomName = () =>
  ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] +
  NOUNS[Math.floor(Math.random() * NOUNS.length)] +
  Math.floor(Math.random() * 99 + 1);

function OnlineStrip({ onlineUsers, myUid }) {
  const others = onlineUsers.filter(u => u.uid !== myUid);
  if (!others.length) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
      <Box display="flex" alignItems="center" gap={0.8} flexWrap="wrap" justifyContent="center" mb={2.5}>
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 7px #22C55E' }} />
        </motion.div>
        <Typography sx={{ color: '#484f58', fontSize: '0.7rem', fontWeight: 700 }}>Online:</Typography>
        {others.slice(0, 6).map(u => (
          <Chip key={u.uid} label={u.name} size="small" sx={{
            height: 20, fontSize: '0.65rem', fontWeight: 800,
            bgcolor: 'rgba(255,255,255,0.05)', color: '#8b949e',
            border: '1px solid rgba(255,255,255,0.09)',
          }} />
        ))}
        {others.length > 6 && (
          <Typography sx={{ color: '#484f58', fontSize: '0.65rem' }}>+{others.length - 6} more</Typography>
        )}
      </Box>
    </motion.div>
  );
}

export function LoginScreen() {
  const { state, loginWithName } = useGameContext();
  const [name, setName]         = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError]       = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    setName(randomName());
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    if (!state.isAuthReady) return;
    const unsub = listenOnlineUsers(setOnlineUsers);
    return unsub;
  }, [state.isAuthReady]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter a name'); return; }
    if (trimmed.length < 2) { setError('At least 2 characters'); return; }
    if (!/^[A-Za-z0-9_\-.]+$/.test(trimmed)) { setError('Letters, numbers, _ - . only (no spaces)'); return; }
    setChecking(true);
    setError('');
    try {
      const available = await checkNameAvailable(trimmed);
      if (!available) {
        setError(`"${trimmed}" is taken — try another`);
        setChecking(false);
        inputRef.current?.select();
        return;
      }
      await loginWithName(trimmed);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
    setChecking(false);
  };

  return (
    <Box sx={{
      height: '100dvh', bgcolor: '#080c12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', px: 2,
    }}>
      {/* Bg orbs */}
      {[
        { color: '#4CC9F0', size: 260, top: '-5%',   left: '-10%',  delay: 0 },
        { color: '#F72585', size: 200, bottom: '-5%', right: '-8%',  delay: 1.5 },
        { color: '#7209B7', size: 170, top: '50%',   left: '5%',    delay: 0.9 },
        { color: '#FFD166', size: 130, top: '20%',   right: '2%',   delay: 2.1 },
      ].map((o, i) => (
        <motion.div key={i} style={{
          position: 'absolute', width: o.size, height: o.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${o.color}22, transparent 70%)`,
          top: o.top, left: o.left, right: o.right, bottom: o.bottom,
          pointerEvents: 'none', zIndex: 0,
        }}
          animate={{ scale: [1, 1.13, 1] }} transition={{ duration: 5+i, repeat: Infinity, delay: o.delay }} />
      ))}
      <Box sx={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.025, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(76,201,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(76,201,240,1) 1px, transparent 1px)',
        backgroundSize: '36px 36px' }} />

      <motion.div initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22,1,0.36,1] }}
        style={{ width: '100%', maxWidth: 400, zIndex: 1 }}>

        {/* Logo */}
        <Box textAlign="center" mb={3.5}>
          <Box display="flex" justifyContent="center" gap={1.5} mb={1.2}>
            {['🎨','🎲','🐍'].map((e,i) => (
              <motion.span key={i} style={{ fontSize: '2.2rem', display: 'inline-block' }}
                animate={{ y: [0,-10,0] }} transition={{ duration: 2.6+i*0.4, repeat: Infinity, delay: i*0.55 }}>
                {e}
              </motion.span>
            ))}
          </Box>
          <Typography sx={{
            fontFamily: '"Fredoka One", cursive', fontSize: { xs: '2.5rem', sm: '2.9rem' }, lineHeight: 1,
            background: 'linear-gradient(130deg, #4CC9F0 0%, #F72585 52%, #FFD166 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Celebrations</Typography>
          <Typography sx={{ color: '#484f58', fontSize: '0.78rem', fontWeight: 700, mt: 0.6 }}>
            Draw · Race · Play — with friends
          </Typography>
        </Box>

        <OnlineStrip onlineUsers={onlineUsers} myUid={state.userId} />

        {/* Card */}
        <Box component="form" onSubmit={handleSubmit} sx={{
          bgcolor: 'rgba(14,21,32,0.93)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: '22px',
          p: { xs: '22px 20px', sm: '28px 28px' },
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}>
          <Typography sx={{ color: '#484f58', fontSize: '0.65rem', fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1.2 }}>
            Choose your name
          </Typography>

          <TextField
            inputRef={inputRef}
            fullWidth
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="e.g. SwiftTiger42"
            autoComplete="off"
            inputProps={{ maxLength: 18, spellCheck: false }}
            disabled={checking}
            sx={{
              mb: error ? 1.5 : 2.5,
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px', fontSize: '1.2rem', fontWeight: 800,
                color: '#4CC9F0', letterSpacing: '0.02em',
                bgcolor: 'rgba(76,201,240,0.05)',
                '& fieldset': { borderColor: 'rgba(76,201,240,0.3)', borderWidth: 2 },
                '&:hover fieldset': { borderColor: 'rgba(76,201,240,0.55)' },
                '&.Mui-focused fieldset': { borderColor: '#4CC9F0' },
                '& input': { py: '13px' },
              },
            }}
          />

          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="err" initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <Alert severity="error" sx={{ mb: 2, borderRadius: '12px', py: '4px',
                  bgcolor: 'rgba(239,35,60,0.09)', color: '#EF233C',
                  border: '1px solid rgba(239,35,60,0.25)', fontSize: '0.8rem',
                  '& .MuiAlert-icon': { color: '#EF233C' } }}>
                  {error}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" fullWidth variant="contained"
            disabled={checking || !name.trim()}
            endIcon={checking ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
            sx={{
              py: 1.5, borderRadius: '14px', fontWeight: 900, fontSize: '1rem',
              background: name.trim() && !checking ? 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)' : 'rgba(255,255,255,0.06)',
              color: name.trim() && !checking ? 'white' : '#484f58',
              boxShadow: name.trim() && !checking ? '0 6px 24px rgba(76,201,240,0.35)' : 'none',
              transition: 'all 0.25s',
              '&:hover': { filter: 'brightness(1.1)', transform: 'translateY(-1px)' },
              '&.Mui-disabled': { background: 'rgba(255,255,255,0.05)', color: '#484f58' },
            }}>
            {checking ? 'Checking…' : "Let's Play"}
          </Button>

          <Typography sx={{ textAlign: 'center', mt: 1.8, fontSize: '0.68rem', color: '#2a3848' }}>
            Names are unique per session · No account needed
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );
}

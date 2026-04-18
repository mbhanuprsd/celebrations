// src/components/LoginScreen.js
import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Chip, Divider, TextField } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../context/GameContext';
import { listenOnlineUsers } from '../firebase/services';

function OnlineStrip({ onlineUsers, myUid }) {
  const others = onlineUsers.filter(u => u.uid !== myUid);
  if (!others.length) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
      <Box display="flex" alignItems="center" gap={0.8} flexWrap="wrap" justifyContent="center" mb={2.5}>
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22C55E', boxShadow: '0 0 7px #22C55E' }} />
        </motion.div>
        <Typography sx={{ color: '#484f58', fontSize: '0.7rem', fontWeight: 700 }}>Online now:</Typography>
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

/** Google "G" logo as an inline SVG */
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ display: 'block', flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

export function LoginScreen() {
  const { state, loginWithGoogle, loginAnonymously } = useGameContext();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [guestName, setGuestName] = useState('');

  // Use auth-specific loading flag so game-level isLoading never bleeds into login UI
  const isLoading = state.isAuthLoading;

  useEffect(() => {
    if (!state.isAuthReady) return;
    const unsub = listenOnlineUsers(setOnlineUsers);
    return unsub;
  }, [state.isAuthReady]);

  const handleSignIn = () => loginWithGoogle();
  const handleAnonSignIn = async () => {
    if (!guestName.trim()) return;
    await loginAnonymously(guestName.trim());
  };

  return (
    <Box sx={{
      height: '100dvh', bgcolor: '#080c12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', px: 2,
    }}>
      {/* Background orbs */}
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
          animate={{ scale: [1, 1.13, 1] }} transition={{ duration: 5 + i, repeat: Infinity, delay: o.delay }} />
      ))}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 0, opacity: 0.025, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(76,201,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(76,201,240,1) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', maxWidth: 400, zIndex: 1 }}
      >
        {/* Logo */}
        <Box textAlign="center" mb={3.5}>
          <Box display="flex" justifyContent="center" gap={1.5} mb={1.2}>
            {['🎨', '🎲', '🐍'].map((e, i) => (
              <motion.span key={i} style={{ fontSize: '2.2rem', display: 'inline-block' }}
                animate={{ y: [0, -10, 0] }} transition={{ duration: 2.6 + i * 0.4, repeat: Infinity, delay: i * 0.55 }}>
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

        {/* Sign-in card */}
        <Box sx={{
          bgcolor: 'rgba(14,21,32,0.93)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: '22px',
          p: { xs: '28px 20px', sm: '36px 32px' },
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          textAlign: 'center',
        }}>
          <Typography sx={{
            color: '#e6edf3', fontWeight: 900, fontSize: '1.15rem', mb: 0.6,
          }}>
            Welcome back 👋
          </Typography>
          <Typography sx={{ color: '#484f58', fontSize: '0.78rem', mb: 3 }}>
            Sign in with your Google account to play
          </Typography>

          <AnimatePresence mode="wait">
            {state.error && (
              <motion.div key="err" initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <Alert severity="error" sx={{
                  mb: 2.5, borderRadius: '12px', py: '4px',
                  bgcolor: 'rgba(239,35,60,0.09)', color: '#EF233C',
                  border: '1px solid rgba(239,35,60,0.25)', fontSize: '0.8rem',
                  '& .MuiAlert-icon': { color: '#EF233C' },
                }}>
                  {state.error}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            fullWidth
            variant="contained"
            onClick={handleSignIn}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <GoogleLogo />}
            sx={{
              py: 1.5, borderRadius: '14px', fontWeight: 800, fontSize: '0.95rem',
              bgcolor: 'white', color: '#1f1f1f',
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              textTransform: 'none', letterSpacing: 0,
              '&:hover': { bgcolor: '#f5f5f5', boxShadow: '0 6px 28px rgba(0,0,0,0.45)', transform: 'translateY(-1px)' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: '#484f58' },
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? 'Signing in…' : 'Continue with Google'}
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, my: 2 }}>
            <Divider sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: '0.65rem', color: '#484f58', fontWeight: 700 }}>OR</Typography>
            <Divider sx={{ flex: 1 }} />
          </Box>

          <TextField
            fullWidth
            variant="outlined"
            placeholder="Enter your nickname"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            disabled={isLoading}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                color: '#e6edf3',
                borderRadius: '14px',
                bgcolor: 'rgba(255,255,255,0.05)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              },
              '& label': { color: '#8b949e' },
            }}
          />

          <Button
            fullWidth
            variant="outlined"
            onClick={handleAnonSignIn}
            disabled={isLoading || !guestName.trim()}
            sx={{
              py: 1.5, borderRadius: '14px', fontWeight: 800, fontSize: '0.95rem',
              borderColor: 'rgba(255,255,255,0.2)', color: '#e6edf3',
              textTransform: 'none', letterSpacing: 0,
              '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.05)' },
              '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.08)', color: '#484f58' },
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? 'Signing in…' : 'Play as Guest'}
          </Button>

          <Typography sx={{ mt: 2.5, fontSize: '0.66rem', color: '#2a3848', lineHeight: 1.5 }}>
            Your Google name is used as your initial username.
            <br />You can change it anytime from the home screen.
          </Typography>
        </Box>
      </motion.div>
    </Box>
  );
}
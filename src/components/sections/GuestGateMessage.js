import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useGameContext } from '../../context/GameContext';

function GuestGateMessage({ feature }) {
  const { loginWithGoogle } = useGameContext();
  return (
    <Box sx={{
      textAlign: 'center', py: 7, px: 3, borderRadius: '22px',
      border: '1px dashed rgba(255,255,255,0.1)',
      background: 'rgba(14,21,32,0.6)',
    }}>
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <Typography sx={{ fontSize: '2.8rem', mb: 1.5 }}>🔒</Typography>
      </motion.div>
      <Typography sx={{ color: '#e6edf3', fontWeight: 900, fontSize: '1rem', mb: 0.6 }}>
        {feature} requires a Google account
      </Typography>
      <Typography sx={{ color: '#484f58', fontSize: '0.78rem', mb: 3, lineHeight: 1.5 }}>
        Guest accounts can't access {feature.toLowerCase()}.<br />Sign in with Google to unlock it.
      </Typography>
      <Button
        variant="contained"
        onClick={loginWithGoogle}
        startIcon={
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ display: 'block' }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
        }
        sx={{
          bgcolor: 'white', color: '#1f1f1f', borderRadius: '14px',
          fontWeight: 800, fontSize: '0.9rem', textTransform: 'none',
          px: 3, py: 1.2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          '&:hover': { bgcolor: '#f0f0f0', transform: 'translateY(-1px)', boxShadow: '0 6px 24px rgba(0,0,0,0.5)' },
          transition: 'all 0.2s',
        }}
      >
        Continue with Google
      </Button>
    </Box>
  );
}

export { GuestGateMessage };

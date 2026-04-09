// src/games/drawing/WordSelector.js
import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, LinearProgress, Paper } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { DrawingGameEngine } from './DrawingGameEngine';

export function WordSelector({ roomId, userId, room, onWordSelected }) {
  const [choices, setChoices] = useState([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [selected, setSelected] = useState(null);
  const isDrawer = room.currentDrawer === userId;

  useEffect(() => {
    if (isDrawer) {
      const engine = new DrawingGameEngine(roomId, userId, room);
      setChoices(engine.getWordChoices());
      setTimeLeft(15);
    }
  }, [isDrawer, roomId]);

  // Auto-select countdown
  useEffect(() => {
    if (!isDrawer || !choices.length) return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          // Auto-pick random
          const auto = choices[Math.floor(Math.random() * choices.length)];
          handleSelect(auto);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isDrawer, choices]);

  const handleSelect = async (word) => {
    if (selected) return;
    setSelected(word);
    await onWordSelected(word);
  };

  const drawerName = room.players?.[room.currentDrawer]?.name || 'Someone';

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 100,
      bgcolor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <Paper elevation={0} sx={{
          borderRadius: 5, p: 4, textAlign: 'center', maxWidth: 480, width: '90vw',
          background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {isDrawer ? (
            <>
              <motion.div
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{ fontSize: '3rem', display: 'inline-block' }}
              >
                ✏️
              </motion.div>
              <Typography variant="h5" sx={{ fontFamily: '"Fredoka One", cursive', mt: 1, mb: 0.5 }}>
                Choose your word!
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {timeLeft}s to decide or it picks for you
              </Typography>
              <LinearProgress
                variant="determinate" value={(timeLeft / 15) * 100}
                sx={{ mb: 3, height: 8, borderRadius: 4,
                  '& .MuiLinearProgress-bar': {
                    background: timeLeft > 7
                      ? 'linear-gradient(90deg, #06D6A0, #4361EE)'
                      : 'linear-gradient(90deg, #FF6B6B, #F72585)'
                  }
                }}
              />
              <Box display="flex" flexDirection="column" gap={1.5}>
                {choices.map((word, i) => (
                  <motion.div key={word}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button
                      fullWidth variant={selected === word ? 'contained' : 'outlined'}
                      color="primary" size="large"
                      onClick={() => handleSelect(word)}
                      disabled={!!selected}
                      sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 800,
                        borderRadius: 3, letterSpacing: '0.5px',
                        borderWidth: 2,
                      }}
                    >
                      {word}
                    </Button>
                  </motion.div>
                ))}
              </Box>
            </>
          ) : (
            <>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ fontSize: '3rem', display: 'inline-block' }}
              >
                🎨
              </motion.div>
              <Typography variant="h5" sx={{ fontFamily: '"Fredoka One", cursive', mt: 1 }}>
                {drawerName} is choosing...
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Get ready to guess!
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
                {[0,1,2].map(i => (
                  <motion.div key={i}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.3 }}
                    style={{ width: 10, height: 10, borderRadius: '50%', background: '#4361EE' }}
                  />
                ))}
              </Box>
            </>
          )}
        </Paper>
      </motion.div>
    </Box>
  );
}

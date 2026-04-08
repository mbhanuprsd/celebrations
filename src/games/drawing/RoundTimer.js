// src/games/drawing/RoundTimer.js
import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { motion } from 'framer-motion';
import TimerIcon from '@mui/icons-material/Timer';

export function RoundTimer({ totalTime, startTime, onTimeout }) {
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!startTime) return;
    calledRef.current = false;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalTime - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0 && !calledRef.current) {
        calledRef.current = true;
        onTimeout?.();
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startTime, totalTime, onTimeout]);

  const pct = (timeLeft / totalTime) * 100;
  const urgent = timeLeft <= 10;
  const mid = timeLeft <= 30;

  const barColor = urgent
    ? 'linear-gradient(90deg, #EF233C, #F72585)'
    : mid
    ? 'linear-gradient(90deg, #FFD166, #FF8C00)'
    : 'linear-gradient(90deg, #06D6A0, #4CC9F0)';

  return (
    <Box sx={{ width: '100%' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <TimerIcon sx={{ fontSize: 16, color: urgent ? 'error.main' : 'text.secondary' }} />
          <Typography variant="caption" fontWeight={700} color={urgent ? 'error.main' : 'text.secondary'}>
            TIME LEFT
          </Typography>
        </Box>
        <motion.div
          key={timeLeft}
          initial={{ scale: urgent ? 1.3 : 1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.15 }}
        >
          <Typography variant="h6" fontWeight={800} sx={{
            color: urgent ? 'error.main' : mid ? 'warning.main' : 'success.main',
            fontFamily: 'monospace',
            minWidth: 32, textAlign: 'right',
          }}>
            {timeLeft}
          </Typography>
        </motion.div>
      </Box>
      <LinearProgress
        variant="determinate" value={pct}
        sx={{
          height: 10, borderRadius: 5,
          bgcolor: 'rgba(0,0,0,0.08)',
          '& .MuiLinearProgress-bar': {
            background: barColor,
            borderRadius: 5,
            transition: 'transform 0.5s linear',
          },
        }}
      />
    </Box>
  );
}

// src/games/ludo/LudoDice.js — Dark mode, Ludo King style
import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

const DOT_POS = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,22],[72,22],[28,50],[72,50],[28,78],[72,78]],
};

function DieFace({ value, size = 60, faceColor = '#1e2530', dotColor = 'white', borderColor }) {
  const dots = DOT_POS[value] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect x="4" y="4" width="92" height="92" rx="18" fill={faceColor}
        stroke={borderColor || 'rgba(255,255,255,0.15)'} strokeWidth="3" />
      {/* Inner shadow */}
      <rect x="8" y="8" width="84" height="84" rx="14" fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8.5" fill={dotColor} />
      ))}
    </svg>
  );
}

export function LudoDice({ value, canRoll, onRoll, myColor, colorHex }) {
  const [rolling, setRolling] = useState(false);

  const handleRoll = async () => {
    if (!canRoll || rolling) return;
    setRolling(true);
    
    // Start the animation immediately
    const rollPromise = onRoll();
    
    // Ensure the animation lasts at least 550ms, but also waits for the Firebase update
    await Promise.all([
      rollPromise,
      new Promise(resolve => setTimeout(resolve, 550))
    ]);
    
    setRolling(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <motion.div
        whileHover={canRoll ? { scale: 1.1 } : {}}
        whileTap={canRoll ? { scale: 0.88 } : {}}
        animate={rolling ? {
          rotate: [0,-20,20,-15,15,-8,8,0],
          scale: [1,1.18,0.9,1.12,0.95,1.05,0.98,1],
        } : {}}
        transition={{ duration: 0.55 }}
        onClick={handleRoll}
        style={{ cursor: canRoll ? 'pointer' : 'default', position: 'relative' }}
      >
        {/* Outer ring when can roll */}
        {canRoll && (
          <motion.div style={{
            position: 'absolute', inset: -5, borderRadius: 22,
            border: `2.5px solid ${colorHex}`,
            pointerEvents: 'none',
          }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
        )}
        <AnimatePresence mode="wait">
          <motion.div key={value ?? 'none'}
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.22 }}>
            <DieFace value={value || 1} size={64}
              faceColor={value ? '#1e2530' : '#161b22'}
              dotColor={value ? colorHex : '#30363d'}
              borderColor={value ? colorHex + '80' : undefined}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <Typography variant="caption" fontWeight={800} sx={{ color: canRoll ? colorHex : '#8b949e', fontSize: '0.7rem' }}>
        {canRoll ? 'TAP TO ROLL' : value ? `ROLLED ${value}` : 'WAITING...'}
      </Typography>
    </Box>
  );
}

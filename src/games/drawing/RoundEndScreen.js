// src/games/drawing/RoundEndScreen.js
import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, Paper, LinearProgress } from '@mui/material';
import { motion } from 'framer-motion';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

const MEDALS = ['🥇','🥈','🥉'];

export function RoundEndScreen({ room }) {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const players = Object.values(room?.players || {})
    .sort((a, b) => b.score - a.score);

  const word = room?.currentWord;
  const topScore = Math.max(...players.map(p => p.score), 1);

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 100,
      bgcolor: 'rgba(26,26,46,0.88)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
    }}>
      {/* Confetti particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div key={i} style={{
          position: 'absolute', width: 8, height: 8,
          bgcolor: ['#4361EE','#F72585','#FFD166','#06D6A0','#FF6B6B'][i % 5],
          borderRadius: i % 2 === 0 ? '50%' : 2,
          left: `${Math.random() * 100}%`,
          top: -20,
          background: ['#4361EE','#F72585','#FFD166','#06D6A0','#FF6B6B'][i % 5],
        }}
          animate={{ y: ['0vh', '110vh'], rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)], opacity: [1, 0.3] }}
          transition={{ duration: 2.5 + Math.random() * 2, delay: Math.random() * 0.5, ease: 'linear' }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        style={{ width: '100%', maxWidth: 500 }}
      >
        <Paper elevation={0} sx={{
          borderRadius: 5, overflow: 'hidden',
          border: '3px solid rgba(255,255,255,0.1)',
        }}>
          {/* Header */}
          <Box sx={{
            background: 'linear-gradient(135deg, #4361EE, #F72585)',
            px: 3, py: 2.5, textAlign: 'center',
          }}>
            <EmojiEventsIcon sx={{ fontSize: 40, color: '#FFD166', mb: 1 }} />
            <Typography variant="h5" sx={{ color: 'white', fontFamily: '"Fredoka One", cursive', fontWeight: 800 }}>
              Round Over!
            </Typography>
            {word && (
              <Box sx={{
                mt: 1, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 3,
                px: 2, py: 0.5, display: 'inline-block',
              }}>
                <Typography variant="body1" sx={{ color: 'white', fontWeight: 700 }}>
                  The word was: <strong>{word.toUpperCase()}</strong>
                </Typography>
              </Box>
            )}
          </Box>

          {/* Scores */}
          <Box sx={{ p: 2.5, bgcolor: '#161b22' }}>
            <Typography variant="body2" fontWeight={700} color="text.secondary" mb={2} textAlign="center">
              CURRENT STANDINGS
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {players.map((player, i) => (
                <motion.div key={player.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 300 }}
                >
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 1, borderRadius: 3,
                    bgcolor: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(67,97,238,0.03)',
                    border: i === 0 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(67,97,238,0.08)',
                  }}>
                    <Typography sx={{ fontSize: '1.4rem', width: 28 }}>
                      {MEDALS[i] || `${i + 1}.`}
                    </Typography>
                    <Avatar sx={{ bgcolor: player.avatar?.color, width: 32, height: 32, fontSize: '0.75rem', fontWeight: 800 }}>
                      {player.avatar?.initials}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>{player.name}</Typography>
                      <LinearProgress variant="determinate"
                        value={(player.score / topScore) * 100}
                        sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(67,97,238,0.1)',
                          '& .MuiLinearProgress-bar': {
                            background: i === 0
                              ? 'linear-gradient(90deg, #FFD166, #FF8C00)'
                              : 'linear-gradient(90deg, #4361EE, #F72585)'
                          }
                        }}
                      />
                    </Box>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.08 + 0.3, type: 'spring' }}
                    >
                      <Typography variant="body1" fontWeight={800} color="primary.main">
                        {player.score}
                      </Typography>
                    </motion.div>
                  </Box>
                </motion.div>
              ))}
            </Box>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Next round in <strong>{countdown}</strong>s...
              </Typography>
              <LinearProgress variant="determinate" value={(countdown / 4) * 100}
                sx={{ mt: 1, height: 4, borderRadius: 2 }}
              />
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
}

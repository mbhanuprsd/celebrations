// src/games/drawing/FinalScores.js
import React, { useEffect, useRef } from 'react';
import {
  Box, Typography, Avatar, Paper, Button, Divider, Chip
} from '@mui/material';
import { motion } from 'framer-motion';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ReplayIcon from '@mui/icons-material/Replay';
import HomeIcon from '@mui/icons-material/Home';
import { useRoom } from '../../hooks/useRoom';
import { useGameContext } from '../../context/GameContext';
import { saveGameHistory } from '../../firebase/services';

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const FUN_MESSAGES = [
  'Absolute legend! 👑',
  'So close! Almost had it! 🔥',
  'Better luck next time! 💪',
  'Keep practicing! 🎨',
];

export function FinalScores() {
  const { state } = useGameContext();
  const { reset, leave } = useRoom();
  const { room, isHost, userId } = state;

  const players = Object.values(room?.players || {})
    .sort((a, b) => b.score - a.score);
  const winner = players[0];
  const isWinner = winner?.id === userId;

  // Save game history once when final scores are shown
  const savedRef = useRef(false);
  useEffect(() => {
    if (!userId || !room || savedRef.current) return;
    savedRef.current = true;
    const myRank = players.findIndex(p => p.id === userId) + 1;
    saveGameHistory(userId, {
      gameType: 'drawing',
      roomId: room.id,
      myRank,
      totalPlayers: players.length,
      winnerName: winner?.name || '',
      rankedPlayers: players.map((p, i) => ({
        name: p.name,
        score: p.score || 0,
        rank: i + 1,
        isMe: p.id === userId,
      })),
    });
  }, [userId, room]); // eslint-disable-line

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      p: 2, position: 'relative', overflow: 'hidden',
    }}>
      {/* Fireworks */}
      {[...Array(12)].map((_, i) => (
        <motion.div key={i} style={{
          position: 'absolute',
          width: 6, height: 6,
          borderRadius: '50%',
          background: ['#4361EE','#F72585','#FFD166','#06D6A0','#FF6B6B','#4CC9F0'][i % 6],
          left: `${10 + i * 7.5}%`,
          top: `${5 + (i % 3) * 30}%`,
        }}
          animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: 560, zIndex: 1 }}
      >
        {/* Trophy header */}
        <Box textAlign="center" mb={3}>
          <motion.div
            animate={{ rotate: [-10, 10, -10], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-block' }}
          >
            <EmojiEventsIcon sx={{ fontSize: 72, color: '#FFD166', filter: 'drop-shadow(0 4px 20px rgba(255,215,0,0.6))' }} />
          </motion.div>
          <Typography variant="h3" sx={{
            fontFamily: '"Fredoka One", cursive', color: 'white',
            textShadow: '0 2px 20px rgba(255,215,0,0.4)', mt: 1,
          }}>
            Game Over!
          </Typography>
          {winner && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: 'spring' }}>
              <Typography variant="h6" sx={{ color: '#FFD166', mt: 1, fontWeight: 700 }}>
                🎉 {isWinner ? 'You win!' : `${winner.name} wins!`} 🎉
              </Typography>
            </motion.div>
          )}
        </Box>

        <Paper elevation={0} sx={{ borderRadius: 5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Podium top 3 */}
          {players.length >= 2 && (
            <Box sx={{
              background: 'linear-gradient(135deg, #4361EE20, #F7258520)',
              p: 3, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 1,
            }}>
              {/* 2nd place */}
              {players[1] && (
                <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Box textAlign="center">
                    <Typography sx={{ fontSize: '2rem' }}>🥈</Typography>
                    <Avatar sx={{ bgcolor: players[1].avatar?.color, width: 48, height: 48, mx: 'auto', mb: 0.5, fontWeight: 800 }}>
                      {players[1].avatar?.initials}
                    </Avatar>
                    <Typography variant="caption" fontWeight={700} sx={{ color: 'rgba(255,255,255,0.9)', display: 'block' }}>
                      {players[1].name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#C0C0C0', fontWeight: 800 }}>
                      {players[1].score} pts
                    </Typography>
                    <Box sx={{ bgcolor: '#C0C0C0', height: 60, width: 70, borderRadius: '4px 4px 0 0', mt: 1 }} />
                  </Box>
                </motion.div>
              )}

              {/* 1st place */}
              <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Box textAlign="center">
                  <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Typography sx={{ fontSize: '2.5rem' }}>🥇</Typography>
                  </motion.div>
                  <Avatar sx={{ bgcolor: players[0].avatar?.color, width: 60, height: 60, mx: 'auto', mb: 0.5, fontWeight: 800, fontSize: '1rem', border: '3px solid #FFD166' }}>
                    {players[0].avatar?.initials}
                  </Avatar>
                  <Typography variant="body2" fontWeight={800} sx={{ color: 'white', display: 'block' }}>
                    {players[0].id === userId ? 'You!' : players[0].name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#FFD166', fontWeight: 800 }}>
                    {players[0].score} pts
                  </Typography>
                  <Box sx={{ bgcolor: '#FFD700', height: 90, width: 80, borderRadius: '4px 4px 0 0', mt: 1 }} />
                </Box>
              </motion.div>

              {/* 3rd place */}
              {players[2] && (
                <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <Box textAlign="center">
                    <Typography sx={{ fontSize: '1.8rem' }}>🥉</Typography>
                    <Avatar sx={{ bgcolor: players[2].avatar?.color, width: 42, height: 42, mx: 'auto', mb: 0.5, fontWeight: 800 }}>
                      {players[2].avatar?.initials}
                    </Avatar>
                    <Typography variant="caption" fontWeight={700} sx={{ color: 'rgba(255,255,255,0.9)', display: 'block' }}>
                      {players[2].name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#CD7F32', fontWeight: 800 }}>
                      {players[2].score} pts
                    </Typography>
                    <Box sx={{ bgcolor: '#CD7F32', height: 40, width: 65, borderRadius: '4px 4px 0 0', mt: 1 }} />
                  </Box>
                </motion.div>
              )}
            </Box>
          )}

          {/* Full leaderboard */}
          <Box sx={{ p: 2.5, bgcolor: 'white' }}>
            <Typography variant="body2" fontWeight={700} color="text.secondary" mb={1.5}>
              FULL STANDINGS
            </Typography>
            {players.map((player, i) => (
              <motion.div key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.07 }}
              >
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 1,
                  borderBottom: i < players.length - 1 ? '1px solid rgba(67,97,238,0.06)' : 'none',
                }}>
                  <Typography sx={{ minWidth: 24, fontWeight: 800, color: RANK_COLORS[i] || 'text.secondary' }}>
                    {MEDALS[i] || `${i + 1}.`}
                  </Typography>
                  <Avatar sx={{ bgcolor: player.avatar?.color, width: 32, height: 32, fontSize: '0.75rem', fontWeight: 800 }}>
                    {player.avatar?.initials}
                  </Avatar>
                  <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
                    {player.id === userId ? 'You' : player.name}
                  </Typography>
                  <Chip
                    label={`${player.score} pts`}
                    size="small" color={i === 0 ? 'warning' : 'default'}
                    sx={{ fontWeight: 800, minWidth: 68 }}
                  />
                </Box>
              </motion.div>
            ))}

            <Divider sx={{ my: 2 }} />

            {/* Action buttons */}
            <Box display="flex" gap={1}>
              <Button variant="outlined" color="inherit" startIcon={<HomeIcon />}
                onClick={leave} sx={{ flex: 0 }}>
                Home
              </Button>
              {isHost && (
                <Button fullWidth variant="contained" color="primary"
                  startIcon={<ReplayIcon />} onClick={reset} size="large">
                  Play Again!
                </Button>
              )}
              {!isHost && (
                <Button fullWidth variant="outlined" disabled sx={{ flex: 1 }}>
                  Waiting for host to restart...
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
}

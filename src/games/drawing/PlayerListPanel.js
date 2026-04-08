// src/games/drawing/PlayerListPanel.js
import React from 'react';
import {
  Box, Typography, Avatar, Paper, Chip, LinearProgress
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import BrushIcon from '@mui/icons-material/Brush';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';

export function PlayerListPanel({ room, userId }) {
  const players = Object.values(room?.players || {})
    .sort((a, b) => b.score - a.score);
  
  const topScore = Math.max(...players.map(p => p.score), 1);
  const guessedPlayers = room?.guessedPlayers || {};
  const isPlaying = ['playing', 'roundEnd'].includes(room?.status);

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: 0.5,
      height: '100%', overflowY: 'auto',
      '&::-webkit-scrollbar': { width: 4 },
      '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(67,97,238,0.2)', borderRadius: 4 },
    }}>
      {/* Header */}
      <Paper elevation={0} sx={{
        px: 1.5, py: 1, borderRadius: 3, mb: 0.5,
        background: 'linear-gradient(135deg, #4361EE10, #F7258510)',
        border: '1px solid rgba(67,97,238,0.1)',
      }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          👥 PLAYERS ({players.length})
        </Typography>
        {isPlaying && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Round {room.currentRound}/{room.settings?.rounds}
          </Typography>
        )}
      </Paper>

      <AnimatePresence>
        {players.map((player, i) => {
          const isDrawer = player.id === room?.currentDrawer;
          const hasGuessed = !!guessedPlayers[player.id];
          const isMe = player.id === userId;
          const isHost = player.id === room?.hostId;
          const scorePct = (player.score / topScore) * 100;

          return (
            <motion.div
              key={player.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.04 }}
            >
              <Paper elevation={0} sx={{
                px: 1.5, py: 1, borderRadius: 3,
                border: isMe
                  ? '2px solid rgba(67,97,238,0.5)'
                  : isDrawer
                  ? '2px solid rgba(247,37,133,0.4)'
                  : '1px solid rgba(67,97,238,0.08)',
                bgcolor: isDrawer ? 'rgba(247,37,133,0.03)' : isMe ? 'rgba(67,97,238,0.03)' : 'white',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Score bar background */}
                {player.score > 0 && (
                  <Box sx={{
                    position: 'absolute', bottom: 0, left: 0, height: 3,
                    width: `${scorePct}%`, borderRadius: '0 2px 2px 0',
                    background: 'linear-gradient(90deg, #4361EE, #F72585)',
                    transition: 'width 0.6s ease',
                  }} />
                )}

                <Box display="flex" alignItems="center" gap={1}>
                  {/* Rank */}
                  <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ minWidth: 16 }}>
                    {i + 1}
                  </Typography>

                  {/* Avatar */}
                  <Box sx={{ position: 'relative' }}>
                    <Avatar sx={{
                      bgcolor: player.avatar?.color,
                      width: 32, height: 32, fontSize: '0.75rem', fontWeight: 800,
                    }}>
                      {player.avatar?.initials || player.name[0]}
                    </Avatar>
                    {isDrawer && isPlaying && (
                      <BrushIcon sx={{
                        position: 'absolute', bottom: -4, right: -4,
                        fontSize: 14, color: '#F72585',
                        bgcolor: 'white', borderRadius: '50%', p: '1px',
                      }} />
                    )}
                    {hasGuessed && isPlaying && !isDrawer && (
                      <CheckCircleIcon sx={{
                        position: 'absolute', bottom: -4, right: -4,
                        fontSize: 14, color: '#06D6A0',
                        bgcolor: 'white', borderRadius: '50%',
                      }} />
                    )}
                  </Box>

                  {/* Name + badges */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography variant="caption" fontWeight={700} sx={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 70,
                      }}>
                        {isMe ? 'You' : player.name}
                      </Typography>
                      {isHost && <StarIcon sx={{ fontSize: 11, color: '#FFD166' }} />}
                    </Box>
                    {isDrawer && isPlaying && (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#F72585', fontWeight: 700 }}>
                          ✏️ Drawing
                        </Typography>
                      </motion.div>
                    )}
                  </Box>

                  {/* Score */}
                  <Typography variant="caption" fontWeight={800} color="primary.main">
                    {player.score}
                  </Typography>
                </Box>
              </Paper>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Box>
  );
}

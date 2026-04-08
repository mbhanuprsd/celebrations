// src/components/Lobby.js
import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip, Avatar,
  List, ListItem, ListItemAvatar, ListItemText, IconButton,
  Tooltip, Divider, CircularProgress
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import StarIcon from '@mui/icons-material/Star';
import PersonIcon from '@mui/icons-material/Person';
import { useGameContext } from '../context/GameContext';
import { useRoom } from '../hooks/useRoom';
import { DrawingGameEngine } from '../games/drawing/DrawingGameEngine';
import { sendSystemMessage } from '../firebase/services';

export function Lobby() {
  const { state, notify } = useGameContext();
  const { leave } = useRoom();
  const { room, isHost, userId } = state;
  const [starting, setStarting] = useState(false);

  if (!room) return null;

  const players = Object.values(room.players || {});
  const canStart = isHost && players.length >= 2;

  const copyCode = () => {
    navigator.clipboard.writeText(room.id);
    notify('Room code copied! 📋');
  };

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    try {
      const playerOrder = players.map(p => p.id).sort(() => Math.random() - 0.5);
      const engine = new DrawingGameEngine(state.roomId, userId, room);
      await engine.onStartGame(playerOrder);
    } catch(e) {
      console.error(e);
      setStarting(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F0F4FF 0%, #E8F5FF 50%, #FFF0F8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      p: 2,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ width: '100%', maxWidth: 520 }}
      >
        {/* Header */}
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" sx={{
            fontFamily: '"Fredoka One", cursive',
            background: 'linear-gradient(135deg, #4361EE, #F72585)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Waiting Room 🎨
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Waiting for players to join...
          </Typography>
        </Box>

        {/* Room code card */}
        <Card elevation={0} sx={{ mb: 2, border: '2px solid rgba(67,97,238,0.15)', borderRadius: 4 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>ROOM CODE</Typography>
              <Tooltip title="Copy code">
                <IconButton size="small" onClick={copyCode}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{
              background: 'linear-gradient(135deg, #4361EE15, #F7258515)',
              borderRadius: 3, p: 2, textAlign: 'center',
              border: '2px dashed rgba(67,97,238,0.3)',
            }}>
              <Typography variant="h3" sx={{
                fontFamily: 'monospace', fontWeight: 800, letterSpacing: '8px',
                color: '#4361EE',
              }}>
                {room.id}
              </Typography>
            </Box>
            <Box display="flex" gap={1} mt={2} flexWrap="wrap">
              <Chip icon={<PersonIcon />} label={`${players.length}/${room.settings.maxPlayers} players`} size="small" color="primary" variant="outlined" />
              <Chip label={`${room.settings.rounds} rounds`} size="small" color="secondary" variant="outlined" />
              <Chip label={`${room.settings.drawTime}s draw time`} size="small" color="success" variant="outlined" />
            </Box>
          </CardContent>
        </Card>

        {/* Player list */}
        <Card elevation={0} sx={{ mb: 2, border: '2px solid rgba(67,97,238,0.1)', borderRadius: 4 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600} mb={1}>
              PLAYERS ({players.length})
            </Typography>
            <List dense disablePadding>
              <AnimatePresence>
                {players.map((player, i) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ListItem sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: player.avatar?.color, width: 38, height: 38, fontSize: '0.85rem', fontWeight: 800 }}>
                          {player.avatar?.initials || player.name[0].toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Typography variant="body1" fontWeight={700}>{player.name}</Typography>
                            {player.id === room.hostId && (
                              <Chip icon={<StarIcon sx={{ fontSize: '12px!important' }} />}
                                label="Host" size="small" color="warning"
                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }}
                              />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </motion.div>
                ))}
              </AnimatePresence>
            </List>
            {players.length < 2 && (
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Need at least 2 players to start
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Box display="flex" gap={1}>
          <Button variant="outlined" color="error" startIcon={<ExitToAppIcon />} onClick={leave}>
            Leave
          </Button>
          {isHost ? (
            <Button fullWidth variant="contained" color="primary" size="large"
              startIcon={starting ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleStart} disabled={!canStart || starting}
              sx={{ py: 1.5 }}
            >
              {starting ? 'Starting...' : `Start Game (${players.length} players)`}
            </Button>
          ) : (
            <Button fullWidth variant="outlined" disabled sx={{ py: 1.5 }}>
              Waiting for host to start...
            </Button>
          )}
        </Box>
      </motion.div>
    </Box>
  );
}

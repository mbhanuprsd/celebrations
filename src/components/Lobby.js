// src/components/Lobby.js — Dark mode
import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip, Avatar,
  List, ListItem, ListItemAvatar, ListItemText, IconButton,
  Tooltip, CircularProgress
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import StarIcon from '@mui/icons-material/Star';
import { useGameContext } from '../context/GameContext';
import { useRoom } from '../hooks/useRoom';
import { DrawingGameEngine } from '../games/drawing/DrawingGameEngine';
import { LudoGameEngine } from '../games/ludo/LudoGameEngine';
import { SnakeLadderGameEngine } from '../games/snakeladder/SnakeLadderGameEngine';
import { GAME_META } from '../core/GameEngine';

const GAME_ENGINES = { drawing: DrawingGameEngine, ludo: LudoGameEngine, snakeladder: SnakeLadderGameEngine };

export function Lobby() {
  const { state, notify } = useGameContext();
  const { leave } = useRoom();
  const { room, isHost, userId } = state;
  const [starting, setStarting] = useState(false);

  if (!room) return null;

  const players = Object.values(room.players || {});
  const gameType = room.gameType || 'drawing';
  const meta = GAME_META[gameType] || GAME_META.drawing;
  const minPlayers = meta.minPlayers || 2;
  const canStart = isHost && players.length >= minPlayers;

  const copyCode = () => { navigator.clipboard.writeText(room.id); notify('Copied! 📋'); };

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    try {
      const playerOrder = [...players.map(p => p.id)].sort(() => Math.random() - 0.5);
      const EngineClass = GAME_ENGINES[gameType] || DrawingGameEngine;
      await new EngineClass(state.roomId, userId, room).onStartGame(playerOrder);
    } catch(e) { console.error(e); setStarting(false); }
  };

  const settingChips = (gameType === 'ludo' || gameType === 'snakeladder')
    ? [<Chip key="mp" label={`Up to ${room.settings?.maxPlayers} players`} size="small" sx={{ bgcolor: gameType === 'snakeladder' ? 'rgba(6,214,160,0.1)' : 'rgba(255,209,102,0.1)', color: gameType === 'snakeladder' ? '#06D6A0' : '#FFD166', border: '1px solid ' + (gameType === 'snakeladder' ? 'rgba(6,214,160,0.3)' : 'rgba(255,209,102,0.3)'), fontWeight: 700, height: 24 }} />]
    : [
        <Chip key="mp" label={`${players.length}/${room.settings?.maxPlayers} players`} size="small" sx={{ bgcolor: 'rgba(76,201,240,0.1)', color: '#4CC9F0', border: '1px solid rgba(76,201,240,0.3)', fontWeight: 700, height: 24 }} />,
        <Chip key="r" label={`${room.settings?.rounds} rounds`} size="small" sx={{ bgcolor: 'rgba(247,37,133,0.1)', color: '#F72585', border: '1px solid rgba(247,37,133,0.3)', fontWeight: 700, height: 24 }} />,
        <Chip key="dt" label={`${room.settings?.drawTime}s`} size="small" sx={{ bgcolor: 'rgba(6,214,160,0.1)', color: '#06D6A0', border: '1px solid rgba(6,214,160,0.3)', fontWeight: 700, height: 24 }} />,
      ];

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
      background: 'radial-gradient(ellipse at 20% 50%, rgba(76,201,240,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(247,37,133,0.06) 0%, transparent 50%), #0d1117',
    }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        style={{ width: '100%', maxWidth: 460 }}>

        <Box textAlign="center" mb={3}>
          <Typography sx={{ fontSize: '3rem', lineHeight: 1 }}>{meta.icon}</Typography>
          <Typography variant="h4" sx={{
            fontFamily: '"Fredoka One", cursive',
            background: 'linear-gradient(135deg, #4CC9F0, #F72585)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mt: 0.5,
          }}>{meta.label} — Lobby</Typography>
          <Typography variant="body2" sx={{ color: '#8b949e', mt: 0.5 }}>{meta.description}</Typography>
        </Box>

        {/* Room code */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="caption" sx={{ color: '#8b949e', fontWeight: 700, letterSpacing: 1 }}>ROOM CODE</Typography>
              <Tooltip title="Copy">
                <IconButton size="small" onClick={copyCode} sx={{ color: '#8b949e' }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ bgcolor: 'rgba(76,201,240,0.06)', border: '1px dashed rgba(76,201,240,0.3)', borderRadius: 2, p: 1.5, textAlign: 'center', cursor: 'pointer' }} onClick={copyCode}>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '2rem', letterSpacing: '10px', color: '#4CC9F0' }}>
                {room.id}
              </Typography>
            </Box>
            <Box display="flex" gap={0.8} mt={1.5} flexWrap="wrap">{settingChips}</Box>
          </CardContent>
        </Card>

        {/* Players */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="caption" sx={{ color: '#8b949e', fontWeight: 700, letterSpacing: 1, display: 'block', mb: 1 }}>
              PLAYERS ({players.length}/{room.settings?.maxPlayers})
            </Typography>
            <List dense disablePadding>
              <AnimatePresence>
                {players.map((player, i) => (
                  <motion.div key={player.id}
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }} transition={{ delay: i * 0.04 }}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: player.avatar?.color, width: 36, height: 36, fontSize: '0.8rem', fontWeight: 800 }}>
                          {player.avatar?.initials || player.name[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Typography fontWeight={700} sx={{ color: '#e6edf3' }}>{player.name}</Typography>
                          {player.id === room.hostId && (
                            <Chip icon={<StarIcon sx={{ fontSize: '11px!important', color: '#FFD166!important' }} />}
                              label="Host" size="small"
                              sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: 'rgba(255,209,102,0.12)', color: '#FFD166', border: '1px solid rgba(255,209,102,0.3)' }} />
                          )}
                          {player.id === userId && (
                            <Chip label="You" size="small"
                              sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: 'rgba(76,201,240,0.1)', color: '#4CC9F0', border: '1px solid rgba(76,201,240,0.3)' }} />
                          )}
                        </Box>
                      } />
                    </ListItem>
                  </motion.div>
                ))}
              </AnimatePresence>
            </List>
            {players.length < minPlayers && (
              <Typography variant="caption" sx={{ color: '#8b949e', display: 'block', textAlign: 'center', mt: 1 }}>
                Need at least {minPlayers} players
              </Typography>
            )}
          </CardContent>
        </Card>

        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={leave}
            sx={{ color: '#EF233C', borderColor: 'rgba(239,35,60,0.3)', '&:hover': { borderColor: '#EF233C', bgcolor: 'rgba(239,35,60,0.08)' } }}>
            Leave
          </Button>
          {isHost ? (
            <Button fullWidth variant="contained" color="primary" size="large"
              startIcon={starting ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleStart} disabled={!canStart || starting} sx={{ py: 1.4 }}>
              {starting ? 'Starting...' : `Start ${meta.icon} (${players.length} players)`}
            </Button>
          ) : (
            <Button fullWidth variant="outlined" disabled
              sx={{ borderColor: 'rgba(255,255,255,0.08)', color: '#8b949e', py: 1.4 }}>
              Waiting for host...
            </Button>
          )}
        </Box>
      </motion.div>
    </Box>
  );
}

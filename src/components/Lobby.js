// src/components/Lobby.js — Mobile-first dark redesign
import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip, Avatar,
  List, ListItem, ListItemAvatar, ListItemText, IconButton,
  Tooltip, CircularProgress,
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
import { UnoGameEngine } from '../games/uno/UnoGameEngine';
import { GAME_META } from '../core/GameEngine';

const GAME_ENGINES = { drawing: DrawingGameEngine, ludo: LudoGameEngine, snakeladder: SnakeLadderGameEngine, uno: UnoGameEngine };

const GAME_GRADIENTS = {
  drawing: 'linear-gradient(135deg, #4CC9F0 0%, #7209B7 100%)',
  ludo: 'linear-gradient(135deg, #FFD166 0%, #EF476F 100%)',
  snakeladder: 'linear-gradient(135deg, #06D6A0 0%, #118AB2 100%)',
};
const GAME_GLOW = { drawing: '#4CC9F0', ludo: '#FFD166', snakeladder: '#06D6A0' };

export function Lobby() {
  const { state, notify } = useGameContext();
  const { leave } = useRoom();
  const { room, isHost, userId } = state;
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const players = Object.values(room.players || {});
  const gameType = room.gameType || 'drawing';
  const meta = GAME_META[gameType] || GAME_META.drawing;
  const minPlayers = meta.minPlayers || 2;
  const canStart = isHost && players.length >= minPlayers;
  const glow = GAME_GLOW[gameType] || '#4CC9F0';
  const grad = GAME_GRADIENTS[gameType] || GAME_GRADIENTS.drawing;

  const copyCode = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    notify('Copied! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    try {
      const playerOrder = [...players.map(p => p.id)].sort(() => Math.random() - 0.5);
      const EngineClass = GAME_ENGINES[gameType] || DrawingGameEngine;
      await new EngineClass(state.roomId, userId, room).onStartGame(playerOrder);
    } catch (e) { console.error(e); setStarting(false); }
  };

  // Settings chips
  const chips = gameType === 'drawing' ? [
    { label: `${players.length}/${room.settings?.maxPlayers} players`, color: '#4CC9F0' },
    { label: `${room.settings?.rounds} rounds`, color: '#F72585' },
    { label: `${room.settings?.drawTime}s draw`, color: '#06D6A0' },
  ] : [
    { label: `Up to ${room.settings?.maxPlayers} players`, color: glow },
  ];

  return (
    <Box sx={{
      minHeight: '100dvh', bgcolor: '#080c12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      p: { xs: 1.5, sm: 2 }, position: 'relative', overflow: 'hidden',
    }}>
      {/* Bg glow */}
      <Box sx={{
        position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${glow}15 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0
      }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 440, zIndex: 1 }}>

        {/* Header */}
        <Box textAlign="center" mb={2.5}>
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
            <Typography sx={{ fontSize: '2.8rem', lineHeight: 1 }}>{meta.icon}</Typography>
          </motion.div>
          <Typography sx={{
            fontFamily: '"Fredoka One", cursive', fontSize: { xs: '1.5rem', sm: '1.8rem' },
            background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            mt: 0.5, lineHeight: 1.1,
          }}>
            {meta.label}
          </Typography>
          <Typography sx={{ color: '#484f58', fontSize: '0.75rem', mt: 0.4 }}>
            {meta.description}
          </Typography>
        </Box>

        {/* Room code card */}
        <Card sx={{
          mb: 2, bgcolor: 'rgba(14,21,32,0.95)', border: `1px solid ${glow}25`,
          borderRadius: '20px', boxShadow: `0 8px 40px ${glow}15`
        }}>
          <CardContent sx={{ p: { xs: '16px', sm: '20px' } }}>
            <Typography sx={{
              color: '#484f58', fontSize: '0.65rem', fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1.2
            }}>
              Room Code — Share with friends
            </Typography>
            {/* Code display */}
            <Box onClick={copyCode} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              bgcolor: `${glow}0e`, border: `1.5px dashed ${glow}40`,
              borderRadius: '14px', px: 2, py: 1.2, cursor: 'pointer',
              transition: 'all 0.2s',
              '&:active': { transform: 'scale(0.98)' },
            }}>
              <Typography sx={{
                fontFamily: 'monospace', fontWeight: 900,
                fontSize: { xs: '1.8rem', sm: '2.2rem' },
                letterSpacing: { xs: '8px', sm: '12px' }, color: glow,
              }}>
                {room.id}
              </Typography>
              <Box sx={{
                bgcolor: copied ? `${glow}25` : `${glow}12`,
                borderRadius: '10px', p: '6px 10px',
                border: `1px solid ${glow}30`,
                display: 'flex', alignItems: 'center', gap: 0.5,
                transition: 'all 0.2s',
              }}>
                <ContentCopyIcon sx={{ fontSize: 15, color: glow }} />
                <Typography sx={{ fontSize: '0.68rem', color: glow, fontWeight: 800 }}>
                  {copied ? 'Copied!' : 'Copy'}
                </Typography>
              </Box>
            </Box>
            {/* Settings chips */}
            <Box display="flex" flexWrap="wrap" gap={0.8} mt={1.5}>
              {chips.map((c, i) => (
                <Chip key={i} label={c.label} size="small" sx={{
                  height: 22, fontSize: '0.65rem', fontWeight: 700,
                  bgcolor: `${c.color}15`, color: c.color, border: `1px solid ${c.color}30`,
                }} />
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Players card */}
        <Card sx={{
          mb: 2, bgcolor: 'rgba(14,21,32,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px'
        }}>
          <CardContent sx={{ p: { xs: '16px', sm: '20px' } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography sx={{
                color: '#484f58', fontSize: '0.65rem', fontWeight: 800,
                letterSpacing: '0.1em', textTransform: 'uppercase'
              }}>
                Players
              </Typography>
              <Chip label={`${players.length} / ${room.settings?.maxPlayers}`} size="small"
                sx={{
                  height: 20, fontSize: '0.62rem', fontWeight: 700,
                  bgcolor: 'rgba(255,255,255,0.05)', color: '#8b949e',
                  border: '1px solid rgba(255,255,255,0.08)'
                }} />
            </Box>
            <List dense disablePadding>
              <AnimatePresence>
                {players.map((player, i) => (
                  <motion.div key={player.id}
                    initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 14 }} transition={{ delay: i * 0.05 }}>
                    <ListItem sx={{
                      px: '10px', py: '7px', mb: 0.6, borderRadius: '12px',
                      bgcolor: player.id === userId ? 'rgba(76,201,240,0.05)' : 'rgba(255,255,255,0.025)',
                      border: player.id === userId ? '1px solid rgba(76,201,240,0.15)' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <ListItemAvatar sx={{ minWidth: 40 }}>
                        <Avatar sx={{
                          bgcolor: player.avatar?.color, width: 32, height: 32,
                          fontSize: '0.75rem', fontWeight: 900,
                          boxShadow: player.id === room.hostId ? `0 0 10px ${player.avatar?.color}60` : 'none',
                        }}>
                          {player.avatar?.initials || player.name[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={0.6} flexWrap="wrap">
                            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#e6edf3' }}>
                              {player.name}
                            </Typography>
                            {player.id === room.hostId && (
                              <Chip icon={<StarIcon sx={{ fontSize: '10px !important', color: '#FFD166 !important' }} />}
                                label="Host" size="small" sx={{
                                  height: 17, fontSize: '0.58rem', fontWeight: 800,
                                  bgcolor: 'rgba(255,209,102,0.1)', color: '#FFD166',
                                  border: '1px solid rgba(255,209,102,0.25)',
                                }} />
                            )}
                            {player.id === userId && (
                              <Chip label="You" size="small" sx={{
                                height: 17, fontSize: '0.58rem', fontWeight: 800,
                                bgcolor: 'rgba(76,201,240,0.1)', color: '#4CC9F0',
                                border: '1px solid rgba(76,201,240,0.25)',
                              }} />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </motion.div>
                ))}
              </AnimatePresence>
            </List>
            {players.length < minPlayers && (
              <Box sx={{
                mt: 1, py: 0.8, px: 1.2, borderRadius: '10px',
                bgcolor: 'rgba(247,37,133,0.05)', border: '1px solid rgba(247,37,133,0.15)',
                textAlign: 'center'
              }}>
                <Typography sx={{ color: '#F72585', fontSize: '0.73rem', fontWeight: 700 }}>
                  Need at least {minPlayers} players to start
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Box display="flex" gap={1.2}>
          <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={leave}
            sx={{
              flexShrink: 0, borderRadius: '14px', py: 1.3, px: 2,
              color: '#EF233C', borderColor: 'rgba(239,35,60,0.3)',
              fontSize: { xs: '0.8rem', sm: '0.9rem' },
              '&:hover': { borderColor: '#EF233C', bgcolor: 'rgba(239,35,60,0.07)' },
            }}>
            Leave
          </Button>
          {isHost ? (
            <Button fullWidth variant="contained" size="large"
              startIcon={starting ? <CircularProgress size={15} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleStart} disabled={!canStart || starting}
              sx={{
                borderRadius: '14px', py: 1.3, fontWeight: 900,
                fontSize: { xs: '0.88rem', sm: '1rem' },
                background: canStart ? grad : 'rgba(255,255,255,0.06)',
                color: canStart ? (gameType === 'ludo' ? '#1a0800' : 'white') : '#484f58',
                boxShadow: canStart ? `0 6px 22px ${glow}40` : 'none',
                '&:hover': { filter: 'brightness(1.1)' },
                transition: 'all 0.2s',
              }}>
              {starting ? 'Starting…' : `Start Game (${players.length} players)`}
            </Button>
          ) : (
            <Button fullWidth variant="outlined" disabled
              sx={{
                borderRadius: '14px', py: 1.3, borderColor: 'rgba(255,255,255,0.07)',
                color: '#484f58', fontSize: { xs: '0.85rem', sm: '0.95rem' }
              }}>
              Waiting for host…
            </Button>
          )}
        </Box>
      </motion.div>
      <Typography sx={{ position: 'fixed', bottom: 8, fontSize: '0.65rem', color: '#484f58', zIndex: 1 }}>
        Made with ❤️ by <a href="https://github.com/mbhanuprsd" target="_blank" rel="noopener noreferrer" style={{ color: '#F72585' }}>Bhanu Merakanapalli</a>
      </Typography>
    </Box>
  );
}

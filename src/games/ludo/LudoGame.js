// src/games/ludo/LudoGame.js — Ludo King mobile-first layout
import React, { useCallback, useState } from 'react';
import { Box, Typography, IconButton, Button, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';

import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { LudoBoard } from './LudoBoard';
import { LudoDice } from './LudoDice';
import { rollDice, movePiece, resetLudoGame } from './ludoFirebaseService';
import { LUDO_COLORS } from './ludoConstants';

// ─── Corner player card (overlaid on board corners) ────────────────────────
function CornerCard({ color, player, isCurrentTurn, isMe, pieces }) {
  const c = LUDO_COLORS[color];
  if (!c) return null;
  const wonPieces = (pieces?.[color] || []).filter(p => p.step >= 57).length;
  return (
    <Box sx={{
      bgcolor: 'rgba(13,17,23,0.88)', backdropFilter: 'blur(8px)',
      border: `1.5px solid ${isCurrentTurn ? c.hex : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 2, px: 1, py: 0.5, minWidth: 70,
      boxShadow: isCurrentTurn ? `0 0 12px ${c.hex}60` : 'none',
      transition: 'all 0.3s ease',
    }}>
      <Box display="flex" alignItems="center" gap={0.5}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.hex, flexShrink: 0,
          boxShadow: isCurrentTurn ? `0 0 6px ${c.hex}` : 'none' }} />
        <Typography sx={{ color: '#e6edf3', fontWeight: 800, fontSize: '0.7rem', lineHeight: 1.2,
          maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player ? (isMe ? 'You' : player.name) : c.name}
        </Typography>
      </Box>
      <Box display="flex" gap={0.3} mt={0.4}>
        {[0,1,2,3].map(i => {
          const p = pieces?.[color]?.[i];
          const won = p?.step >= 57;
          const active = p?.step >= 0 && p?.step < 57;
          return (
            <Box key={i} sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: won ? c.hex : active ? c.hex+'70' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${c.hex}80`,
            }} />
          );
        })}
      </Box>
      {wonPieces > 0 && (
        <Typography sx={{ color: c.hex, fontWeight: 900, fontSize: '0.65rem', mt: 0.3 }}>
          {wonPieces}/4 home
        </Typography>
      )}
    </Box>
  );
}

// ─── Turn status bar at bottom ─────────────────────────────────────────────
function TurnBar({ currentTurn, isMyTurn, diceRolled, diceValue }) {
  const c = LUDO_COLORS[currentTurn];
  if (!c) return null;
  return (
    <motion.div key={currentTurn} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Box sx={{
        textAlign: 'center', px: 2, py: 0.5,
        background: `linear-gradient(90deg, transparent, ${c.hex}25, transparent)`,
        borderTop: `1px solid ${c.hex}40`,
      }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: c.hex }}>
          {isMyTurn
            ? diceRolled ? `You rolled ${diceValue} — tap a piece!` : `Your turn — roll the dice!`
            : `${c.name}'s turn${diceRolled ? ` (rolled ${diceValue})` : '...'}`}
        </Typography>
      </Box>
    </motion.div>
  );
}

// ─── Game log drawer (slide up) ────────────────────────────────────────────
function GameLogDrawer({ chat, open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
            background: '#161b22', borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px 16px 0 0', maxHeight: '50vh', display: 'flex', flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography fontWeight={800} fontSize="0.85rem">🎲 Game Log</Typography>
            <IconButton size="small" onClick={onClose} sx={{ color: '#8b949e' }}>✕</IconButton>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(chat || []).filter(m => m.type === 'system').slice(-40).reverse().map(msg => (
              <Typography key={msg.id} variant="caption" sx={{ color: '#8b949e', fontStyle: 'italic', display: 'block', py: 0.3 }}>
                {msg.text}
              </Typography>
            ))}
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main LudoGame ─────────────────────────────────────────────────────────
export function LudoGame() {
  const { state, notify } = useGameContext();
  const { leave } = useRoom();
  const { room, userId, roomId, isHost, chat } = state;
  const [actionPending, setActionPending] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const ls = room?.ludoState;
  const myColor = ls?.colorMap?.[userId];
  const isMyTurn = ls?.currentTurn === myColor;
  const canRoll = isMyTurn && !ls?.diceRolled && !ls?.winner;
  const colorInfo = LUDO_COLORS[myColor] || LUDO_COLORS.red;

  const handleRoll = useCallback(async () => {
    if (actionPending) return;
    setActionPending(true);
    try { await rollDice(roomId, userId); }
    catch (e) { console.error(e); }
    finally { setActionPending(false); }
  }, [roomId, userId, actionPending]);

  const handleMovePiece = useCallback(async (pieceId) => {
    if (actionPending || !isMyTurn || !ls?.diceRolled) return;
    setActionPending(true);
    try { await movePiece(roomId, userId, pieceId); }
    catch (e) { console.error(e); }
    finally { setActionPending(false); }
  }, [roomId, userId, isMyTurn, ls?.diceRolled, actionPending]);

  if (!room || !ls) return null;

  const activePlayers = ls.activeColors || [];

  // Map color → player
  const colorToPlayer = {};
  Object.entries(ls.colorMap || {}).forEach(([uid, color]) => {
    colorToPlayer[color] = room.players?.[uid];
  });
  const colorToUid = {};
  Object.entries(ls.colorMap || {}).forEach(([uid, color]) => { colorToUid[color] = uid; });

  // Corner positions: red=top-left, blue=top-right, green=bottom-right, yellow=bottom-left
  const cornerLayout = [
    { color: 'red',    corner: { top: 8, left: 8 } },
    { color: 'blue',   corner: { top: 8, right: 8 } },
    { color: 'green',  corner: { bottom: 80, right: 8 } },
    { color: 'yellow', corner: { bottom: 80, left: 8 } },
  ];

  return (
    <Box sx={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      bgcolor: '#0d1117', position: 'relative', overflow: 'hidden',
    }}>
      {/* ── Top bar ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, bgcolor: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <Typography sx={{
          fontFamily: '"Fredoka One", cursive', fontSize: '1.3rem',
          background: 'linear-gradient(135deg, #4CC9F0, #F72585)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Ludo</Typography>

        <Box display="flex" alignItems="center" gap={1}>
          <Chip label="🎲 Ludo" size="small" sx={{ bgcolor: 'rgba(76,201,240,0.1)', color: '#4CC9F0', border: '1px solid rgba(76,201,240,0.3)', fontWeight: 700, height: 24 }} />
          <Chip label={roomId} size="small" onClick={() => { navigator.clipboard.writeText(roomId); notify('Copied!'); }}
            sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, cursor: 'pointer', height: 24, bgcolor: 'rgba(255,255,255,0.05)', color: '#8b949e' }} />
          <IconButton size="small" onClick={leave} sx={{ color: '#EF233C', p: 0.5 }}>
            <ExitToAppIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* ── Board area (fills remaining space) ── */}
      <Box sx={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: 1 }}>

        {/* Board */}
        <Box sx={{
          width: '100%', maxWidth: 'min(calc(100vh - 180px), 520px)',
          aspectRatio: '1/1', borderRadius: 3, overflow: 'hidden',
          boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
          position: 'relative',
        }}>
          <LudoBoard ludoState={ls} userId={userId} onMovePiece={handleMovePiece} />

          {/* Corner player cards overlaid on board */}
          {cornerLayout.map(({ color, corner }) => {
            if (!activePlayers.includes(color)) return null;
            return (
              <Box key={color} sx={{ position: 'absolute', ...corner }}>
                <CornerCard
                  color={color}
                  player={colorToPlayer[color]}
                  isCurrentTurn={ls.currentTurn === color}
                  isMe={colorToUid[color] === userId}
                  pieces={ls.pieces}
                />
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Turn status ── */}
      <TurnBar currentTurn={ls.currentTurn} isMyTurn={isMyTurn}
        diceRolled={ls.diceRolled} diceValue={ls.diceValue} />

      {/* ── Bottom controls ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.5, bgcolor: '#161b22', borderTop: '1px solid rgba(255,255,255,0.08)',
        gap: 2, flexShrink: 0,
      }}>
        {/* Log button */}
        <Button size="small" variant="outlined"
          onClick={() => setLogOpen(true)}
          sx={{ color: '#8b949e', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0, px: 1.5, py: 0.8, fontSize: '0.75rem' }}>
          📋 Log
        </Button>

        {/* Dice — center */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <LudoDice
            value={ls.diceValue}
            canRoll={canRoll && !actionPending}
            onRoll={handleRoll}
            myColor={myColor}
            colorHex={colorInfo.hex}
          />
        </Box>

        {/* My color badge + replay */}
        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
          {myColor && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
              bgcolor: colorInfo.hex + '20', border: `1px solid ${colorInfo.hex}50`,
              borderRadius: 1.5, px: 1, py: 0.3 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorInfo.hex }} />
              <Typography sx={{ color: colorInfo.hex, fontWeight: 900, fontSize: '0.65rem' }}>
                {colorInfo.name.toUpperCase()}
              </Typography>
            </Box>
          )}
          {isHost && ls.winner && (
            <Button size="small" startIcon={<ReplayIcon />}
              onClick={async () => { await resetLudoGame(roomId); notify('Reset!'); }}
              sx={{ fontSize: '0.7rem', py: 0.3, px: 1 }}>
              Again
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Game log drawer ── */}
      <GameLogDrawer chat={chat} open={logOpen} onClose={() => setLogOpen(false)} />
    </Box>
  );
}

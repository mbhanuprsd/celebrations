// src/components/GameSharedUI.js
// Reusable UI shared across all game screens: offline banner, leave confirm, resume banner
import React from 'react';
import { Box, Typography, Button, Modal } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { getStoredSession, clearSession } from '../hooks/useGameSession';

// ── Offline banner (shown at top, never causes auto-leave) ────────────────────
export function OfflineBanner({ online }) {
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline"
          initial={{ y: -44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -44, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 300 }}
        >
          <Box sx={{
            bgcolor: '#78350f',
            px: 2, py: 0.9,
            display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center',
            borderBottom: '1px solid #92400e',
          }}>
            <WifiOffIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#fde68a' }}>
              You're offline — game paused. Reconnecting…
            </Typography>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Leave confirm modal ───────────────────────────────────────────────────────
export function LeaveConfirmModal({ open, onCancel, onConfirm }) {
  return (
    <Modal open={open} onClose={onCancel}
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Box sx={{
          bgcolor: '#0c1a2e', borderRadius: '22px', p: 3,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
          textAlign: 'center', minWidth: 255,
        }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#f0f6fc', mb: 0.8 }}>
            Leave game?
          </Typography>
          <Typography sx={{ fontSize: '0.76rem', color: '#475569', mb: 2.5, lineHeight: 1.5 }}>
            You'll be removed from the room. You cannot rejoin once you leave.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button fullWidth onClick={onCancel} sx={{
              borderRadius: '12px', color: '#64748b',
              border: '1px solid rgba(255,255,255,0.08)', fontWeight: 800,
            }}>
              Stay
            </Button>
            <Button fullWidth variant="contained" onClick={onConfirm} sx={{
              borderRadius: '12px', bgcolor: '#ef4444', fontWeight: 900,
              '&:hover': { bgcolor: '#dc2626' },
            }}>
              Leave
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Modal>
  );
}

// ── Resume banner (shown on HomeScreen when a saved session exists) ───────────
export function ResumeBanner({ onResume, onDismiss }) {
  const session = getStoredSession();
  if (!session) return null;

  const gameLabels = { drawing: '🎨 Draw & Guess', ludo: '🎲 Ludo', snakeladder: '🐍 Snake & Ladder', uno: '🃏 UNO' };

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{ marginBottom: 12 }}
    >
      <Box sx={{
        bgcolor: '#0c1a2e', borderRadius: '16px', p: 2,
        border: '1px solid rgba(167,139,250,0.35)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
      }}>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: '#f0f6fc' }}>
            Resume game?
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#475569' }}>
            {gameLabels[session.gameType] || 'Game'} · Room <b style={{ color: '#94a3b8' }}>{session.roomId}</b>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.8, flexShrink: 0 }}>
          <Button size="small" onClick={() => { clearSession(); onDismiss(); }}
            sx={{ color: '#475569', fontSize: '0.72rem', minWidth: 0 }}>
            Dismiss
          </Button>
          <Button size="small" variant="contained" onClick={() => onResume(session)}
            sx={{ bgcolor: '#7c3aed', borderRadius: '10px', fontWeight: 900, fontSize: '0.72rem', '&:hover': { bgcolor: '#6d28d9' } }}>
            Rejoin
          </Button>
        </Box>
      </Box>
    </motion.div>
  );
}
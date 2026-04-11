// src/games/uno/UnoGame.js
import React, { useState, useMemo } from 'react';
import {
  Box, Typography, IconButton, Button, Chip, Avatar, Modal,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';
import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { playUnoCard, drawUnoCard, resetUnoGame } from './unoFirebaseService';
import { canPlayCard, getCardLabel, UNO_COLOR_META, PLAYABLE_COLORS } from './unoConstants';

// ─── Color constants ────────────────────────────────────────────────────────
const COLORS = UNO_COLOR_META;

// ─── Single UNO card visual ─────────────────────────────────────────────────
function UnoCard({ card, onClick, playable, small, highlighted }) {
  if (!card) return null;
  const isWild = card.color === 'wild';
  const cm = isWild ? null : COLORS[card.color];
  const label = getCardLabel(card);

  const w = small ? 42 : 58;
  const h = small ? 63 : 87;
  const fontSize = small ? '1rem' : label.length > 1 ? '1.1rem' : '1.5rem';

  const bg = isWild
    ? 'linear-gradient(135deg, #DC2626 0%, #2563EB 34%, #16A34A 67%, #CA8A04 100%)'
    : cm?.hex;

  return (
    <motion.div
      whileHover={playable ? { y: -12, scale: 1.08 } : {}}
      whileTap={playable ? { scale: 0.93 } : {}}
      onClick={playable ? onClick : undefined}
      style={{ flexShrink: 0, cursor: playable ? 'pointer' : 'default' }}
    >
      <Box sx={{
        width: w, height: h,
        borderRadius: small ? '7px' : '10px',
        background: bg,
        border: highlighted
          ? '3px solid rgba(255,255,255,0.95)'
          : `2px solid rgba(255,255,255,${playable ? 0.55 : 0.12})`,
        boxShadow: highlighted
          ? '0 0 18px rgba(255,255,255,0.6), 0 6px 16px rgba(0,0,0,0.6)'
          : playable
            ? '0 4px 14px rgba(0,0,0,0.55)'
            : '0 2px 6px rgba(0,0,0,0.4)',
        opacity: playable || highlighted ? 1 : 0.38,
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none',
        transition: 'box-shadow 0.15s, border 0.15s',
      }}>
        {/* Oval */}
        <Box sx={{
          width: '68%', height: '64%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          transform: 'rotate(-25deg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{
            fontSize, fontWeight: 900, color: 'white',
            transform: 'rotate(25deg)',
            textShadow: '1px 2px 4px rgba(0,0,0,0.55)',
            lineHeight: 1,
          }}>
            {label}
          </Typography>
        </Box>
        {/* Corner labels */}
        {!small && (
          <>
            <Typography sx={{ position: 'absolute', top: 3, left: 5, fontSize: '0.5rem', fontWeight: 900, color: 'rgba(255,255,255,0.85)' }}>
              {label}
            </Typography>
            <Typography sx={{ position: 'absolute', bottom: 3, right: 5, fontSize: '0.5rem', fontWeight: 900, color: 'rgba(255,255,255,0.85)', transform: 'rotate(180deg)' }}>
              {label}
            </Typography>
          </>
        )}
      </Box>
    </motion.div>
  );
}

// ─── Card back (draw pile) ──────────────────────────────────────────────────
function CardBack({ count, onClick, disabled }) {
  return (
    <motion.div whileHover={!disabled ? { scale: 1.05 } : {}} whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={!disabled ? onClick : undefined} style={{ cursor: disabled ? 'default' : 'pointer' }}>
      <Box sx={{
        width: 58, height: 87, borderRadius: '10px',
        background: 'linear-gradient(135deg, #1a0a4e 0%, #3b0764 100%)',
        border: `2px solid ${disabled ? 'rgba(255,255,255,0.1)' : 'rgba(139,92,246,0.6)'}`,
        boxShadow: disabled ? 'none' : '0 4px 14px rgba(109,40,217,0.5)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 0.3,
        opacity: disabled ? 0.4 : 1,
        position: 'relative',
      }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: '#a78bfa', letterSpacing: '1px' }}>
          UNO
        </Typography>
        {count > 0 && (
          <Chip label={count} size="small" sx={{
            height: 16, fontSize: '0.55rem', fontWeight: 900,
            bgcolor: 'rgba(139,92,246,0.25)', color: '#c4b5fd',
            border: '1px solid rgba(139,92,246,0.4)',
          }} />
        )}
      </Box>
    </motion.div>
  );
}

// ─── Wild color picker modal ────────────────────────────────────────────────
function ColorPicker({ open, onPick }) {
  return (
    <Modal open={open} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Box sx={{
          bgcolor: '#0e1520', borderRadius: '20px', p: 3,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          textAlign: 'center', minWidth: 260,
        }}>
          <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#e6edf3', mb: 2 }}>
            Choose a color
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
            {PLAYABLE_COLORS.map(color => {
              const cm = COLORS[color];
              return (
                <motion.div key={color} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                  <Box onClick={() => onPick(color)} sx={{
                    bgcolor: cm.hex, borderRadius: '14px', py: 1.5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.7,
                    cursor: 'pointer', boxShadow: `0 4px 16px ${cm.hex}55`,
                    border: '2px solid rgba(255,255,255,0.2)',
                  }}>
                    <Typography sx={{ fontSize: '1.3rem' }}>{cm.emoji}</Typography>
                    <Typography sx={{ fontWeight: 900, color: 'white', fontSize: '0.85rem' }}>{cm.name}</Typography>
                  </Box>
                </motion.div>
              );
            })}
          </Box>
        </Box>
      </motion.div>
    </Modal>
  );
}

// ─── Opponent card count badge ──────────────────────────────────────────────
function OpponentBadge({ player, cardCount, isCurrentTurn, isFinished, rank }) {
  const name = player?.name || '?';
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4,
      px: 0.8, py: 0.6, borderRadius: '12px', minWidth: 56,
      border: `1.5px solid ${isCurrentTurn ? '#a78bfa' : 'rgba(255,255,255,0.07)'}`,
      bgcolor: isCurrentTurn ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
      boxShadow: isCurrentTurn ? '0 0 12px rgba(139,92,246,0.3)' : 'none',
      opacity: isFinished ? 0.5 : 1,
      transition: 'all 0.2s',
    }}>
      <Box sx={{ position: 'relative' }}>
        <Avatar sx={{ width: 28, height: 28, bgcolor: '#7c3aed', fontSize: '0.72rem', fontWeight: 900 }}>
          {name.charAt(0).toUpperCase()}
        </Avatar>
        {isCurrentTurn && (
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}
            style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9,
              borderRadius: '50%', background: '#a78bfa', border: '2px solid #0e1520' }} />
        )}
        {isFinished && (
          <Box sx={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14,
            borderRadius: '50%', bgcolor: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #0e1520', fontSize: '0.5rem', fontWeight: 900, color: '#000' }}>
            {rank}
          </Box>
        )}
      </Box>
      <Typography noWrap sx={{ fontSize: '0.58rem', fontWeight: 800, color: '#c9d1d9', maxWidth: 52 }}>
        {name}
      </Typography>
      {!isFinished && (
        <Chip label={`${cardCount} 🃏`} size="small" sx={{
          height: 15, fontSize: '0.57rem', fontWeight: 900,
          bgcolor: cardCount === 1 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
          color: cardCount === 1 ? '#f87171' : '#8b949e',
          border: cardCount === 1 ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
        }} />
      )}
      {isFinished && (
        <Typography sx={{ fontSize: '0.58rem', fontWeight: 900, color: '#fbbf24' }}>Done!</Typography>
      )}
    </Box>
  );
}

// ─── Active color indicator ─────────────────────────────────────────────────
function ActiveColorDot({ color }) {
  const cm = COLORS[color];
  if (!cm) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cm.hex,
          boxShadow: `0 0 8px ${cm.hex}` }} />
      </motion.div>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: cm.hex }}>{cm.name}</Typography>
    </Box>
  );
}

// ─── Finished podium overlay ────────────────────────────────────────────────
function FinishedOverlay({ rankings, players, onRematch, isHost }) {
  return (
    <Box sx={{
      position: 'absolute', inset: 0, zIndex: 50,
      bgcolor: 'rgba(8,12,18,0.95)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)',
    }}>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
        <Box sx={{ textAlign: 'center', px: 3 }}>
          <Typography sx={{ fontSize: '2.5rem', mb: 0.5 }}>🃏</Typography>
          <Typography sx={{ fontFamily: '"Fredoka One", cursive', fontSize: '2rem', color: '#a78bfa', mb: 2 }}>
            Game Over!
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3, minWidth: 220 }}>
            {rankings.map((uid, i) => {
              const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
              return (
                <Box key={uid} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.2,
                  p: '10px 14px', borderRadius: '14px',
                  bgcolor: i === 0 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                  border: i === 0 ? '1px solid rgba(251,191,36,0.35)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                  <Typography sx={{ fontSize: '1.3rem' }}>{medal}</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: '0.9rem', color: i === 0 ? '#fbbf24' : '#e6edf3' }}>
                    {players?.[uid]?.name || uid}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          {isHost && (
            <Button fullWidth variant="contained" startIcon={<ReplayIcon />} onClick={onRematch}
              sx={{
                py: 1.2, borderRadius: '14px', fontWeight: 900,
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                boxShadow: '0 6px 20px rgba(124,58,237,0.4)',
              }}>
              Play Again
            </Button>
          )}
        </Box>
      </motion.div>
    </Box>
  );
}

// ─── Main UNO game ──────────────────────────────────────────────────────────
export function UnoGame() {
  const { state } = useGameContext();
  const { leave } = useRoom();
  const { room, userId, isHost } = state;

  const [pendingWild, setPendingWild] = useState(null); // card to play after picking color
  const [busy, setBusy] = useState(false);

  const u = room?.unoState;

  // All hooks must run unconditionally before any early return
  const myHand     = useMemo(() => u?.hands?.[userId] || [], [u, userId]);
  const isMyTurn   = !!u && u.playerOrder[u.currentIndex] === userId;
  const opponents  = u?.playerOrder?.filter(id => id !== userId) || [];
  const myRank     = u?.rankings?.indexOf(userId) ?? -1;
  const myFinished = myRank >= 0;
  const gameOver   = !!u?.winner;

  const playableIds = useMemo(() => {
    if (!u || !isMyTurn || myFinished || gameOver) return new Set();
    if (u.pendingDraw > 0) return new Set();
    return new Set(
      myHand.filter(c => canPlayCard(c, u.topCard, u.activeColor)).map(c => c.id)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u, isMyTurn, myFinished, gameOver, myHand]);

  const canDraw = isMyTurn && !myFinished && !gameOver;

  const handlePlay = async (card) => {
    if (busy) return;
    if ((card.type === 'wild' || card.type === 'wild4')) {
      setPendingWild(card);
      return;
    }
    setBusy(true);
    await playUnoCard(room.id, userId, card.id);
    setBusy(false);
  };

  const handleColorPick = async (color) => {
    if (!pendingWild || busy) return;
    const card = pendingWild;
    setPendingWild(null);
    setBusy(true);
    await playUnoCard(room.id, userId, card.id, color);
    setBusy(false);
  };

  const handleDraw = async () => {
    if (!canDraw || busy) return;
    setBusy(true);
    await drawUnoCard(room.id, userId);
    setBusy(false);
  };

  const handleRematch = async () => {
    if (!room) return;
    await resetUnoGame(room.id);
  };

  // Turn status message — must stay above early return (Rules of Hooks)
  const turnMsg = useMemo(() => {
    if (!u) return '';
    if (myFinished) return `You finished #${myRank + 1}!`;
    if (gameOver) return 'Game over!';
    if (isMyTurn) {
      if (u.pendingDraw > 0) return `Draw ${u.pendingDraw} cards!`;
      if (playableIds.size === 0) return 'No playable card — draw!';
      return 'Your turn — play a card!';
    }
    const cur = room?.players?.[u.playerOrder[u.currentIndex]];
    return `${cur?.name || '…'}'s turn`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u, myFinished, myRank, gameOver, isMyTurn, playableIds.size]);

  // Early return after all hooks
  if (!room || !u) return null;

  return (
    <Box sx={{
      height: '100dvh', bgcolor: '#080c12', display: 'flex',
      flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.8, bgcolor: '#0e1520',
        borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontFamily: '"Fredoka One", cursive', fontSize: '1.3rem', color: '#a78bfa' }}>
            UNO
          </Typography>
          <ActiveColorDot color={u.activeColor} />
          <Typography sx={{ fontSize: '0.65rem', color: '#484f58' }}>
            {u.direction === 1 ? '→' : '←'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isHost && (
            <IconButton size="small" onClick={handleRematch}
              sx={{ color: '#8b949e', bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', p: 0.5 }}>
              <ReplayIcon sx={{ fontSize: 15 }} />
            </IconButton>
          )}
          <IconButton size="small" onClick={leave}
            sx={{ color: '#EF233C', bgcolor: 'rgba(239,35,60,0.06)',
              border: '1px solid rgba(239,35,60,0.2)', borderRadius: '8px', p: 0.5 }}>
            <ExitToAppIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Opponents row */}
      <Box sx={{
        display: 'flex', gap: 0.8, px: 1.5, py: 0.8, overflowX: 'auto',
        flexShrink: 0, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        bgcolor: '#0b1019', borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {opponents.map((uid) => {
          const rank = u.rankings?.indexOf(uid);
          return (
            <OpponentBadge
              key={uid}
              player={room.players?.[uid]}
              cardCount={u.hands?.[uid]?.length || 0}
              isCurrentTurn={u.playerOrder[u.currentIndex] === uid}
              isFinished={rank >= 0}
              rank={rank >= 0 ? rank + 1 : null}
            />
          );
        })}
      </Box>

      {/* Center play area */}
      <Box sx={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 3, px: 2, position: 'relative',
      }}>
        {/* Draw pile */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
          <CardBack count={u.deck?.length || 0} onClick={handleDraw} disabled={!canDraw} />
          <Typography sx={{ fontSize: '0.62rem', color: '#484f58', fontWeight: 700 }}>DRAW</Typography>
        </Box>

        {/* Discard pile */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
          <AnimatePresence mode="popLayout">
            <motion.div key={u.topCard?.id}
              initial={{ scale: 0.6, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}>
              <UnoCard card={u.topCard} playable={false} highlighted />
            </motion.div>
          </AnimatePresence>
          <Typography sx={{ fontSize: '0.62rem', color: '#484f58', fontWeight: 700 }}>DISCARD</Typography>
        </Box>
      </Box>

      {/* Turn indicator */}
      <Box sx={{
        px: 2, py: 0.6, flexShrink: 0, textAlign: 'center',
        background: isMyTurn && !myFinished
          ? 'linear-gradient(90deg, transparent, rgba(139,92,246,0.15), transparent)'
          : 'transparent',
        borderTop: `1px solid ${isMyTurn && !myFinished ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)'}`,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <Typography sx={{
          fontSize: '0.78rem', fontWeight: 800,
          color: isMyTurn && !myFinished ? '#a78bfa' : '#8b949e',
        }}>
          {turnMsg}
        </Typography>
      </Box>

      {/* My hand */}
      <Box sx={{ flexShrink: 0, pb: 'env(safe-area-inset-bottom, 8px)' }}>
        {/* Hand cards */}
        <Box sx={{
          display: 'flex', gap: 0.8, px: 1.5, py: 1.2, overflowX: 'auto',
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
          alignItems: 'flex-end',
        }}>
          {myHand.map((card) => (
            <UnoCard
              key={card.id}
              card={card}
              playable={playableIds.has(card.id) && !busy}
              onClick={() => handlePlay(card)}
            />
          ))}
          {myHand.length === 0 && !myFinished && (
            <Typography sx={{ color: '#484f58', fontSize: '0.8rem', fontStyle: 'italic', py: 3 }}>
              No cards
            </Typography>
          )}
          {myFinished && (
            <Box sx={{ py: 2, px: 1 }}>
              <Typography sx={{ color: '#a78bfa', fontSize: '0.85rem', fontWeight: 900 }}>
                🎉 You're done! #{myRank + 1}
              </Typography>
            </Box>
          )}
        </Box>
        {/* Hand count */}
        <Box sx={{ px: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Avatar sx={{ width: 20, height: 20, bgcolor: '#7c3aed', fontSize: '0.55rem', fontWeight: 900 }}>
            {state.playerName?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Typography sx={{ fontSize: '0.68rem', color: '#8b949e', fontWeight: 700 }}>
            You · {myHand.length} card{myHand.length !== 1 ? 's' : ''}
          </Typography>
          {myHand.length === 1 && !myFinished && (
            <Chip label="UNO!" size="small" sx={{
              height: 16, fontSize: '0.6rem', fontWeight: 900, ml: 0.5,
              bgcolor: 'rgba(239,68,68,0.2)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.4)',
            }} />
          )}
        </Box>
      </Box>

      {/* Wild color picker */}
      <ColorPicker open={!!pendingWild} onPick={handleColorPick} />

      {/* Game over overlay */}
      <AnimatePresence>
        {gameOver && (
          <FinishedOverlay
            rankings={u.rankings || []}
            players={room.players}
            onRematch={handleRematch}
            isHost={isHost}
          />
        )}
      </AnimatePresence>
    </Box>
  );
}
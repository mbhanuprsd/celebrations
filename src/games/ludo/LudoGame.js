// src/games/ludo/LudoGame.js — Ludo King mobile-first, no-scroll, 100dvh
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton, Button, Chip, Avatar } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';

import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { useGameGuard } from '../../hooks/useGameSession';
import { OfflineBanner, LeaveConfirmModal } from '../../components/GameSharedUI';
import { LudoBoard } from './LudoBoard';
import { LudoDice } from './LudoDice';
import { rollDice, movePiece, resetLudoGame } from './ludoFirebaseService';
import { LUDO_COLORS } from './ludoConstants';
import { saveGameHistory } from '../../firebase/services';

// ─── Winner overlay ─────────────────────────────────────────────────────────
function LudoWinnerOverlay({ ls, room, isHost, onReset, onLeave }) {
  const medals = ['🥇','🥈','🥉','🏅'];
  const rankings = ls?.rankings || (ls?.winner ? [ls.winner] : []);
  const allUids = Object.keys(room?.players || {});
  // Any uid not in rankings goes at the end
  const ordered = [...rankings, ...allUids.filter(u => !rankings.includes(u))];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
        <Box sx={{
          bgcolor: '#0e1520', border: '1px solid rgba(255,215,0,0.3)',
          borderRadius: '20px', p: { xs: 3, sm: 4 }, textAlign: 'center',
          maxWidth: 340, width: '90vw', boxShadow: '0 0 70px rgba(255,215,0,0.18)',
        }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Typography sx={{ fontSize: '3rem' }}>🏆</Typography>
          </motion.div>
          <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#ffd700', mb: 0.5 }}>
            Game Over!
          </Typography>
          <Box mt={2} mb={3}>
            {ordered.map((uid, i) => {
              const player = room?.players?.[uid];
              const colorKey = ls?.colorMap?.[uid];
              const c = LUDO_COLORS[colorKey];
              const name = player?.name || uid;
              return (
                <Box key={uid} display="flex" alignItems="center" gap={1.5}
                  sx={{ mb: 1, p: 1, borderRadius: '10px',
                    bgcolor: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ fontSize: '1.3rem', width: 28 }}>{medals[i] || `${i+1}.`}</Typography>
                  <Avatar sx={{ bgcolor: c?.hex || '#4CC9F0', width: 30, height: 30,
                    fontSize: '0.85rem', fontWeight: 900 }}>
                    {name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography sx={{ fontWeight: 800, color: i === 0 ? '#ffd700' : '#e6edf3',
                    fontSize: '0.95rem', flex: 1, textAlign: 'left' }}>
                    {name}
                  </Typography>
                  {c && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.hex, flexShrink: 0 }} />
                  )}
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            {isHost && (
              <Button variant="contained" startIcon={<ReplayIcon />} onClick={onReset}
                sx={{ background: 'linear-gradient(135deg, #06D6A0, #118AB2)',
                  fontWeight: 900, borderRadius: '12px', px: 3 }}>
                Play Again
              </Button>
            )}
            <Button variant="outlined" startIcon={<ExitToAppIcon />} onClick={onLeave}
              sx={{ fontWeight: 900, borderRadius: '12px', px: 3,
                borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444',
                '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
              Leave
            </Button>
          </Box>
        </Box>
      </motion.div>
    </motion.div>
  );
}


function CornerCard({ color, player, isCurrentTurn, isMe, pieces }) {
  const c = LUDO_COLORS[color];
  if (!c) return null;
  const wonPieces = (pieces?.[color] || []).filter(p => p.step >= 57).length;
  return (
    <Box sx={{
      bgcolor: 'rgba(13,17,23,0.88)', backdropFilter: 'blur(8px)',
      border: `1.5px solid ${isCurrentTurn ? c.hex : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 2, px: 0.8, py: 0.4, minWidth: 64,
      boxShadow: isCurrentTurn ? `0 0 12px ${c.hex}60` : 'none',
      transition: 'all 0.3s ease',
    }}>
      <Box display="flex" alignItems="center" gap={0.5}>
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: c.hex, flexShrink: 0,
          boxShadow: isCurrentTurn ? `0 0 6px ${c.hex}` : 'none' }} />
        <Typography sx={{ color: '#e6edf3', fontWeight: 800, fontSize: '0.65rem', lineHeight: 1.2,
          maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player ? (isMe ? 'You' : player.name) : c.name}
        </Typography>
      </Box>
      <Box display="flex" gap={0.3} mt={0.3}>
        {[0,1,2,3].map(i => {
          const p   = pieces?.[color]?.[i];
          const won = p?.step >= 57;
          const act = p?.step >= 0 && p?.step < 57;
          return (
            <Box key={i} sx={{
              width: 7, height: 7, borderRadius: '50%',
              bgcolor: won ? c.hex : act ? c.hex + '70' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${c.hex}80`,
            }} />
          );
        })}
      </Box>
      {wonPieces > 0 && (
        <Typography sx={{ color: c.hex, fontWeight: 900, fontSize: '0.6rem', mt: 0.25 }}>
          {wonPieces}/4 home
        </Typography>
      )}
    </Box>
  );
}

// ─── Slim turn indicator bar ───────────────────────────────────────────────
function TurnBar({ currentTurn, isMyTurn, diceRolled, diceValue }) {
  const c = LUDO_COLORS[currentTurn];
  if (!c) return null;
  return (
    <motion.div key={currentTurn} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
      <Box sx={{
        textAlign: 'center', px: 2, py: 0.4,
        background: `linear-gradient(90deg, transparent, ${c.hex}22, transparent)`,
        borderTop: `1px solid ${c.hex}40`,
      }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.76rem', color: c.hex }}>
          {isMyTurn
            ? diceRolled ? `You rolled ${diceValue} — tap a piece!` : 'Your turn — roll the dice!'
            : `${c.name}'s turn${diceRolled ? ` (rolled ${diceValue})` : '…'}`}
        </Typography>
      </Box>
    </motion.div>
  );
}

// ─── Horizontal scrollable player chips row ────────────────────────────────
function PlayerChips({ activePlayers, colorToPlayer, colorToUid, currentTurn, pieces, userId, ls }) {
  return (
    <Box sx={{
      display: 'flex', overflowX: 'auto', gap: 0.6, px: 1.5, py: 0.5,
      bgcolor: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }}>
      {activePlayers.map(color => {
        const c        = LUDO_COLORS[color];
        const player   = colorToPlayer[color];
        const uid      = colorToUid[color];
        const isCur    = color === currentTurn;
        const isMe     = uid === userId;
        const wonCount = (pieces?.[color] || []).filter(p => p.step >= 57).length;
        return (
          <Box key={color} sx={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5,
            px: 0.8, py: 0.3, borderRadius: '20px',
            border: `1.5px solid ${isCur ? c?.hex : 'rgba(255,255,255,0.08)'}`,
            bgcolor: isCur ? `${c?.hex}14` : 'rgba(255,255,255,0.03)',
            boxShadow: isCur ? `0 0 8px ${c?.hex}30` : 'none',
          }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: c?.hex, flexShrink: 0,
              boxShadow: isCur ? `0 0 5px ${c?.hex}` : 'none' }} />
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: isCur ? c?.hex : '#8b949e', whiteSpace: 'nowrap' }}>
              {isMe ? 'You' : (player?.name || c?.name)}
            </Typography>
            <Typography sx={{ fontSize: '0.58rem', color: '#484f58', fontWeight: 700 }}>
              {wonCount > 0 ? `${wonCount}/4` : ''}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Game log slide-up drawer ──────────────────────────────────────────────
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
            borderRadius: '16px 16px 0 0', maxHeight: '50vh',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            px: 2, py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography fontWeight={800} fontSize="0.82rem">🎲 Game Log</Typography>
            <IconButton size="small" onClick={onClose} sx={{ color: '#8b949e', fontSize: '0.8rem' }}>✕</IconButton>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            {(chat || []).filter(m => m.type === 'system').slice(-40).reverse().map(msg => (
              <Typography key={msg.id} variant="caption" sx={{ color: '#8b949e', fontStyle: 'italic', display: 'block', py: 0.2 }}>
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
  const { leave }         = useRoom();
  const { room, userId, roomId, isHost, chat } = state;
  const [actionPending, setActionPending] = useState(false);
  const [logOpen, setLogOpen]             = useState(false);

  const { online, confirmOpen, requestLeave, cancelLeave, confirmLeave } = useGameGuard({
    roomId, userId, gameType: 'ludo', leaveCallback: leave,
  });

  const ls         = room?.ludoState;
  const myColor    = ls?.colorMap?.[userId];
  const isMyTurn   = ls?.currentTurn === myColor;
  const canRoll    = isMyTurn && !ls?.diceRolled && !ls?.winner;
  const colorInfo  = LUDO_COLORS[myColor] || LUDO_COLORS.red;

  // Save game history once when a winner is declared
  const ludoSavedRef = useRef(false);
  useEffect(() => {
    if (!ls?.winner || !userId || !room || ludoSavedRef.current) return;
    ludoSavedRef.current = true;
    const rankings = ls.rankings || [ls.winner];
    const myRank = rankings.indexOf(userId) + 1 || rankings.length + 1;
    const winnerPlayer = room.players?.[ls.winner];
    // Build ranked list — players in rankings order first, then unranked after
    const rankedUids = [...rankings];
    const allUids = Object.keys(room.players || {});
    const unrankedUids = allUids.filter(uid => !rankedUids.includes(uid));
    const orderedUids = [...rankedUids, ...unrankedUids];
    saveGameHistory(userId, {
      gameType: 'ludo',
      roomId: room.id,
      myRank,
      totalPlayers: allUids.length,
      winnerName: winnerPlayer?.name || '',
      rankedPlayers: orderedUids.map((uid, i) => ({
        name: room.players?.[uid]?.name || uid,
        score: null,
        rank: i + 1,
        isMe: uid === userId,
      })),
    });
  }, [ls?.winner]); // eslint-disable-line

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
  const colorToPlayer = {};
  const colorToUid    = {};
  Object.entries(ls.colorMap || {}).forEach(([uid, color]) => {
    colorToPlayer[color] = room.players?.[uid];
    colorToUid[color]    = uid;
  });

  // Corner positions: red=top-left, blue=top-right, green=bottom-right, yellow=bottom-left
  const cornerLayout = [
    { color: 'red',    corner: { top: 6, left: 6 } },
    { color: 'blue',   corner: { top: 6, right: 6 } },
    { color: 'green',  corner: { bottom: 76, right: 6 } },
    { color: 'yellow', corner: { bottom: 76, left: 6 } },
  ];

  return (
    <Box sx={{
      height: '100dvh',
      display: 'flex', flexDirection: 'column',
      bgcolor: '#0d1117', overflow: 'hidden', position: 'relative',
    }}>

      <OfflineBanner online={online} />

      {/* ── Top bar — 38px ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, height: 38, mt: !online ? '36px' : 0,
        bgcolor: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
        transition: 'margin 0.3s',
      }}>
        <Typography sx={{
          fontFamily: '"Fredoka One", cursive', fontSize: '1.1rem',
          background: 'linear-gradient(135deg, #4CC9F0, #F72585)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Ludo</Typography>

        <Box display="flex" alignItems="center" gap={0.8}>
          {myColor && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4,
              bgcolor: colorInfo.hex + '20', border: `1px solid ${colorInfo.hex}50`,
              borderRadius: 1.5, px: 0.8, py: 0.2 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: colorInfo.hex }} />
              <Typography sx={{ color: colorInfo.hex, fontWeight: 900, fontSize: '0.6rem' }}>
                {colorInfo.name.toUpperCase()}
              </Typography>
            </Box>
          )}
          <Chip label={roomId} size="small"
            onClick={() => { navigator.clipboard.writeText(roomId); notify('Copied!'); }}
            sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
              height: 20, bgcolor: 'rgba(255,255,255,0.05)', color: '#8b949e', fontSize: '0.62rem' }} />
          <IconButton size="small" onClick={requestLeave} sx={{ color: '#EF233C', p: 0.3 }}>
            <ExitToAppIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* ── Player chips strip — ~30px ── */}
      <PlayerChips
        activePlayers={activePlayers}
        colorToPlayer={colorToPlayer}
        colorToUid={colorToUid}
        currentTurn={ls.currentTurn}
        pieces={ls.pieces}
        userId={userId}
        ls={ls}
      />

      {/* ── Board area — fills remaining space ── */}
      <Box sx={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden', p: '8px 8px 4px' }}>
        <Box sx={{
          width: '100%',
          maxWidth: 'min(calc(100dvh - 170px), 500px)',
          aspectRatio: '1/1',
          boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.06)',
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

      {/* ── Turn status bar ── */}
      <TurnBar currentTurn={ls.currentTurn} isMyTurn={isMyTurn}
        diceRolled={ls.diceRolled} diceValue={ls.diceValue} />

      {/* ── Bottom controls — compact, 52px ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: '8px',
        bgcolor: '#161b22', borderTop: '1px solid rgba(255,255,255,0.08)',
        gap: 1.5, flexShrink: 0,
        pb: 'max(8px, env(safe-area-inset-bottom))',
      }}>
        {/* Log button */}
        <Button size="small" variant="outlined"
          onClick={() => setLogOpen(true)}
          sx={{ color: '#8b949e', borderColor: 'rgba(255,255,255,0.1)', minWidth: 0,
            px: 1.2, py: 0.5, fontSize: '0.7rem', borderRadius: 2 }}>
          📋
        </Button>

        {/* Dice — centre */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <LudoDice
            value={ls.diceValue}
            canRoll={canRoll && !actionPending}
            onRoll={handleRoll}
            myColor={myColor}
            colorHex={colorInfo.hex}
          />
        </Box>

        {/* Reset (host only, after winner) */}
        {isHost && ls.winner ? (
          <Button size="small" variant="outlined" startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
            onClick={async () => { await resetLudoGame(roomId); notify('Reset!'); }}
            sx={{ fontSize: '0.68rem', py: 0.5, px: 1.2, borderRadius: 2,
              borderColor: 'rgba(255,255,255,0.12)', color: '#8b949e' }}>
            Again
          </Button>
        ) : (
          <Box sx={{ minWidth: 44 }} /> // spacer to keep dice centred
        )}
      </Box>

      {/* ── Game log drawer ── */}
      <GameLogDrawer chat={chat} open={logOpen} onClose={() => setLogOpen(false)} />

      {/* ── Winner overlay — shown to all players ── */}
      <AnimatePresence>
        {ls?.winner && (
          <LudoWinnerOverlay
            ls={ls} room={room} isHost={isHost}
            onReset={async () => { await resetLudoGame(roomId); notify('Reset!'); }}
            onLeave={requestLeave}
          />
        )}
      </AnimatePresence>

      <LeaveConfirmModal open={confirmOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </Box>
  );
}
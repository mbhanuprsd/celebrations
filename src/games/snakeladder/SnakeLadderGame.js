// src/games/snakeladder/SnakeLadderGame.js
import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, Tooltip,
  LinearProgress, Avatar,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';
import CasinoIcon from '@mui/icons-material/Casino';
import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { SnakeLadderBoard } from './SnakeLadderBoard';
import { rollSnakeDice, moveSnakePiece, resetSnakeLadderGame } from './snakeLadderFirebaseService';
import { PLAYER_COLOR_MAP } from './snakeLadderConstants';

// ─── Dice face SVG ─────────────────────────────────────────────────────────
const DOTS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DiceFace({ value, size = 70, color = '#4CC9F0', rolling }) {
  const dots = DOTS[value] || [];
  return (
    <motion.div
      animate={rolling ? { rotate: [0, 180, 360, 540, 720], scale: [1, 1.2, 0.9, 1.1, 1] } : {}}
      transition={{ duration: 0.6 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <rect x={4} y={4} width={92} height={92} rx={18} ry={18}
          fill="#1a2030" stroke={color} strokeWidth={3}
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }} />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={8} fill={color} />
        ))}
      </svg>
    </motion.div>
  );
}

// ─── Player row in sidebar ─────────────────────────────────────────────────
function PlayerRow({ uid, name, pos, colorId, isCurrentTurn, isMe, rank }) {
  const color = PLAYER_COLOR_MAP[colorId];
  const progress = Math.min(100, (pos / 100) * 100);
  const finished = rank > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ marginBottom: 8 }}>
      <Box sx={{
        p: 1.2, borderRadius: 2,
        border: `1.5px solid ${isCurrentTurn ? color?.hex : 'rgba(255,255,255,0.08)'}`,
        bgcolor: isCurrentTurn ? `${color?.hex}15` : 'rgba(255,255,255,0.03)',
        boxShadow: isCurrentTurn ? `0 0 12px ${color?.hex}40` : 'none',
        transition: 'all 0.25s',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: color?.hex, fontSize: '0.75rem', fontWeight: 900, flexShrink: 0 }}>
            {name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: '#e6edf3',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isMe ? 'You' : name}
              </Typography>
              {isCurrentTurn && !finished && (
                <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: color?.hex }}>●</Typography>
                </motion.span>
              )}
              {finished && (
                <Chip label={`#${rank}`} size="small" sx={{
                  height: 16, fontSize: '0.6rem', fontWeight: 900,
                  bgcolor: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32',
                  color: '#000',
                }} />
              )}
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <LinearProgress variant="determinate" value={progress}
                sx={{
                  flex: 1, height: 4, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': { bgcolor: color?.hex, borderRadius: 2 },
                }} />
              <Typography sx={{ fontSize: '0.65rem', color: '#8b949e', flexShrink: 0 }}>
                {pos}/100
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Effect Toast ──────────────────────────────────────────────────────────
function EffectToast({ effect }) {
  if (!effect) return null;
  const isSnake = effect.type === 'snake';
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.7, y: -30 }}
        style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)', zIndex: 20 }}>
        <Box sx={{
          bgcolor: isSnake ? '#EF444490' : '#22C55E90',
          backdropFilter: 'blur(12px)',
          border: `2px solid ${isSnake ? '#EF4444' : '#22C55E'}`,
          borderRadius: 3, px: 3, py: 1.5, textAlign: 'center',
          boxShadow: `0 0 30px ${isSnake ? '#EF444460' : '#22C55E60'}`,
        }}>
          <Typography sx={{ fontSize: '2rem' }}>{isSnake ? '🐍' : '🪜'}</Typography>
          <Typography sx={{ fontWeight: 900, color: 'white', fontSize: '1rem' }}>
            {isSnake ? 'Snake Bite!' : 'Ladder!'}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem' }}>
            {effect.from} → {effect.to}
          </Typography>
        </Box>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Winner Screen ─────────────────────────────────────────────────────────
function WinnerScreen({ rankings, colorMap, room, isHost, onReset }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{
        bgcolor: 'rgba(13,17,23,0.96)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,215,0,0.3)', borderRadius: 4,
        p: 4, textAlign: 'center', maxWidth: 360, width: '90%',
        boxShadow: '0 0 60px rgba(255,215,0,0.2)',
      }}>
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <Typography sx={{ fontSize: '3rem' }}>🏆</Typography>
        </motion.div>
        <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color: '#FFD700', mb: 0.5 }}>
          Game Over!
        </Typography>
        <Box mt={2} mb={3}>
          {rankings.map((uid, i) => {
            const colorId = colorMap?.[uid];
            const color = PLAYER_COLOR_MAP[colorId];
            const name = room?.players?.[uid]?.name || uid;
            return (
              <Box key={uid} display="flex" alignItems="center" gap={1.5}
                sx={{ mb: 1, p: 1, borderRadius: 2, bgcolor: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)' }}>
                <Typography sx={{ fontSize: '1.4rem', width: 30 }}>{medals[i] || `${i + 1}.`}</Typography>
                <Avatar sx={{ bgcolor: color?.hex, width: 32, height: 32, fontWeight: 900, fontSize: '0.9rem' }}>
                  {name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography sx={{ fontWeight: 800, color: i === 0 ? '#FFD700' : '#e6edf3' }}>{name}</Typography>
              </Box>
            );
          })}
        </Box>
        {isHost && (
          <Button variant="contained" startIcon={<ReplayIcon />} onClick={onReset}
            sx={{ bgcolor: '#4CC9F0', '&:hover': { bgcolor: '#38b2d8' } }}>
            Play Again
          </Button>
        )}
      </Box>
    </motion.div>
  );
}

// ─── Main Game ─────────────────────────────────────────────────────────────
export function SnakeLadderGame() {
  const { state } = useGameContext();
  const { leave } = useRoom();
  const { room, roomId, userId } = state;
  const sl = room?.slState;

  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [showEffect, setShowEffect] = useState(false);

  if (!sl) return null;

  const {
    playerOrder = [], colorMap = {}, positions = {},
    currentTurnIndex = 0, diceValue, diceRolled,
    winner, lastEffect, rankings = [],
  } = sl;

  const currentPlayerId = playerOrder[currentTurnIndex];
  const isMyTurn = currentPlayerId === userId;
  const myColorId = colorMap[userId];
  const myColor = PLAYER_COLOR_MAP[myColorId];
  const isHost = room?.hostId === userId;
  const myPos = positions[userId] || 0;
  const myRank = rankings.indexOf(userId) + 1; // 0 if not yet finished
  const alreadyFinished = myRank > 0;

  const handleRoll = useCallback(async () => {
    if (!isMyTurn || diceRolled || rolling || alreadyFinished) return;
    setRolling(true);
    await rollSnakeDice(roomId, userId);
    setRolling(false);
  }, [isMyTurn, diceRolled, rolling, roomId, userId, alreadyFinished]);

  const handleMove = useCallback(async () => {
    if (!isMyTurn || !diceRolled || moving) return;
    setMoving(true);
    const result = await moveSnakePiece(roomId, userId);
    setMoving(false);
    if (result?.effect) {
      setShowEffect(true);
      setTimeout(() => setShowEffect(false), 2200);
    }
  }, [isMyTurn, diceRolled, moving, roomId, userId]);

  const handleReset = useCallback(async () => {
    await resetSnakeLadderGame(roomId);
  }, [roomId]);

  const currentTurnColor = PLAYER_COLOR_MAP[colorMap[currentPlayerId]];

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#0d1117', display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.2, bgcolor: 'rgba(22,27,34,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)', zIndex: 10,
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: '1.4rem' }}>🐍</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#e6edf3' }}>
            Snake & Ladder
          </Typography>
          <Chip label={`Turn ${sl.turnCount || 0}`} size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: '#8b949e', fontSize: '0.65rem' }} />
        </Box>
        <Box display="flex" gap={0.5}>
          {isHost && !winner && (
            <Tooltip title="Reset">
              <IconButton size="small" onClick={handleReset} sx={{ color: '#8b949e' }}>
                <ReplayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Leave">
            <IconButton size="small" onClick={leave} sx={{ color: '#8b949e' }}>
              <ExitToAppIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main layout */}
      <Box sx={{
        flex: 1, display: 'flex', gap: 2, p: 2,
        flexDirection: { xs: 'column', md: 'row' },
        overflow: 'auto',
      }}>
        {/* Board */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ position: 'relative', width: '100%', maxWidth: 580 }}>
            <SnakeLadderBoard slState={sl} room={room} myUserId={userId} />
            {/* Effect overlay */}
            {showEffect && lastEffect && <EffectToast effect={lastEffect} />}
          </Box>

          {/* Turn bar */}
          {!winner && (
            <motion.div key={currentTurnIndex} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ width: '100%', maxWidth: 580 }}>
              <Box sx={{
                p: 1.5, borderRadius: 2,
                background: `linear-gradient(90deg, ${currentTurnColor?.hex}15, transparent)`,
                border: `1px solid ${currentTurnColor?.hex}40`,
                textAlign: 'center',
              }}>
                <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: currentTurnColor?.hex }}>
                  {isMyTurn
                    ? diceRolled
                      ? `You rolled ${diceValue}! Tap "Move" to advance`
                      : `Your turn — Roll the dice!`
                    : `${room?.players?.[currentPlayerId]?.name || currentPlayerId}'s turn`}
                </Typography>
              </Box>
            </motion.div>
          )}
        </Box>

        {/* Sidebar */}
        <Box sx={{ width: { xs: '100%', md: 200 }, flexShrink: 0 }}>
          {/* Players */}
          <Typography sx={{ color: '#8b949e', fontWeight: 700, fontSize: '0.72rem',
            letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1 }}>
            Players
          </Typography>
          {playerOrder.map(uid => {
            const colorId = colorMap[uid];
            const name = room?.players?.[uid]?.name || uid;
            const pos = positions[uid] || 0;
            const rank = rankings.indexOf(uid) + 1;
            const isCurrent = uid === currentPlayerId && !winner;
            return (
              <PlayerRow key={uid} uid={uid} name={name} pos={pos}
                colorId={colorId} isCurrentTurn={isCurrent}
                isMe={uid === userId} rank={rank} />
            );
          })}

          {/* Dice + Controls */}
          {!winner && (
            <Box mt={2} display="flex" flexDirection="column" alignItems="center" gap={1.5}>
              <Typography sx={{ color: '#8b949e', fontWeight: 700, fontSize: '0.72rem',
                letterSpacing: '0.08em', textTransform: 'uppercase', alignSelf: 'flex-start' }}>
                Dice
              </Typography>

              {/* Dice display */}
              <Box sx={{
                p: 1.5, borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: `1px solid ${isMyTurn ? myColor?.hex + '60' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
              }}>
                {diceValue ? (
                  <DiceFace value={diceValue} color={myColor?.hex || '#4CC9F0'} rolling={rolling} size={65} />
                ) : (
                  <Box sx={{ width: 65, height: 65, borderRadius: 2, border: '2px dashed rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CasinoIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '2rem' }} />
                  </Box>
                )}
              </Box>

              {/* Roll button */}
              {isMyTurn && !alreadyFinished && (
                <>
                  {!diceRolled ? (
                    <Button fullWidth variant="contained" onClick={handleRoll}
                      disabled={rolling}
                      startIcon={<CasinoIcon />}
                      sx={{
                        bgcolor: myColor?.hex || '#4CC9F0',
                        '&:hover': { bgcolor: myColor?.hex, filter: 'brightness(1.15)' },
                        fontWeight: 900, py: 1,
                      }}>
                      {rolling ? 'Rolling…' : 'Roll Dice'}
                    </Button>
                  ) : (
                    <Button fullWidth variant="contained" onClick={handleMove}
                      disabled={moving}
                      sx={{
                        bgcolor: '#22C55E',
                        '&:hover': { bgcolor: '#16a34a' },
                        fontWeight: 900, py: 1,
                      }}>
                      {moving ? 'Moving…' : `Move (${diceValue})`}
                    </Button>
                  )}
                </>
              )}

              {/* My position info */}
              <Box sx={{ width: '100%', p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                <Typography sx={{ color: '#8b949e', fontSize: '0.7rem' }}>Your position</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: myColor?.hex || '#4CC9F0' }}>
                  {myPos === 0 ? 'Start' : myPos === 100 ? '🏆 Finish!' : myPos}
                </Typography>
                {myPos > 0 && myPos < 100 && (
                  <Typography sx={{ color: '#8b949e', fontSize: '0.65rem' }}>
                    {100 - myPos} to go
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Legend */}
          <Box mt={2} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ color: '#8b949e', fontWeight: 700, fontSize: '0.68rem',
              textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
              Legend
            </Typography>
            <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
              <Typography sx={{ fontSize: '0.9rem' }}>🪜</Typography>
              <Typography sx={{ color: '#4ADE80', fontSize: '0.72rem', fontWeight: 700 }}>Ladder = climb up</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.8}>
              <Typography sx={{ fontSize: '0.9rem' }}>🐍</Typography>
              <Typography sx={{ color: '#EF4444', fontSize: '0.72rem', fontWeight: 700 }}>Snake = slide down</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Winner overlay */}
      <AnimatePresence>
        {winner && (
          <WinnerScreen
            rankings={rankings}
            colorMap={colorMap}
            room={room}
            isHost={isHost}
            onReset={handleReset}
          />
        )}
      </AnimatePresence>
    </Box>
  );
}

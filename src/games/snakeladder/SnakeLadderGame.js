// src/games/snakeladder/SnakeLadderGame.js
import { useState, useCallback, useRef, useEffect } from 'react';
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
import { useGameGuard } from '../../hooks/useGameSession';
import { OfflineBanner, LeaveConfirmModal } from '../../components/GameSharedUI';
import { SnakeLadderBoard } from './SnakeLadderBoard';
import { rollSnakeDice, moveSnakePiece, resetSnakeLadderGame } from './snakeLadderFirebaseService';
import { PLAYER_COLOR_MAP } from './snakeLadderConstants';
import { saveGameHistory } from '../../firebase/services';

// ─── Dot patterns for dice ─────────────────────────────────────────────────
const DOTS = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,25],[72,25],[28,50],[72,50],[28,75],[72,75]],
};

function DiceFace({ value, size = 64, color = '#4CC9F0', rolling }) {
  const dots = DOTS[value] || [];
  return (
    <motion.div
      animate={rolling ? { rotate: [0, 90, 180, 270, 360, 450, 540], scale: [1, 1.15, 0.9, 1.1, 1] } : {}}
      transition={{ duration: 0.55 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <rect x={4} y={4} width={92} height={92} rx={18}
          fill="#0e1728" stroke={color} strokeWidth={2.5}
          style={{ filter: `drop-shadow(0 0 10px ${color}55)` }} />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={7.5} fill={color} />
        ))}
      </svg>
    </motion.div>
  );
}

// ─── Compact player row ────────────────────────────────────────────────────
function PlayerRow({ uid, name, pos, colorId, isCurrentTurn, isMe, rank }) {
  const color = PLAYER_COLOR_MAP[colorId];
  const finished = rank > 0;
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      p: '8px 10px', borderRadius: '12px', mb: 0.8,
      border: `1.5px solid ${isCurrentTurn ? color?.hex + '80' : 'rgba(255,255,255,0.07)'}`,
      bgcolor: isCurrentTurn ? `${color?.hex}12` : 'rgba(255,255,255,0.025)',
      boxShadow: isCurrentTurn ? `0 0 14px ${color?.hex}30` : 'none',
      transition: 'all 0.22s',
    }}>
      <Avatar sx={{ width: 26, height: 26, bgcolor: color?.hex, fontSize: '0.7rem', fontWeight: 900, flexShrink: 0 }}>
        {name?.charAt(0)?.toUpperCase()}
      </Avatar>
      <Box flex={1} minWidth={0}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography noWrap sx={{ fontWeight: 800, fontSize: '0.75rem', color: '#e6edf3' }}>
            {isMe ? 'You' : name}
          </Typography>
          {isCurrentTurn && !finished && (
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color?.hex }} />
            </motion.div>
          )}
          {finished && (
            <Chip label={`#${rank}`} size="small" sx={{
              height: 15, fontSize: '0.58rem', fontWeight: 900, px: 0.3,
              bgcolor: rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : '#cd7f32', color: '#000',
            }} />
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={0.6}>
          <LinearProgress variant="determinate" value={Math.min(100, pos)}
            sx={{ flex: 1, height: 3, borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.07)',
              '& .MuiLinearProgress-bar': { bgcolor: color?.hex, borderRadius: 2 } }} />
          <Typography sx={{ fontSize: '0.6rem', color: '#8b949e', flexShrink: 0 }}>{pos}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Effect toast ──────────────────────────────────────────────────────────
function EffectToast({ effect, visible }) {
  if (!visible || !effect) return null;
  const isSnake = effect.type === 'snake';
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: -20 }}
          style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translateX(-50%)', zIndex: 30, whiteSpace: 'nowrap' }}>
          <Box sx={{
            bgcolor: isSnake ? 'rgba(127,29,29,0.92)' : 'rgba(20,83,45,0.92)',
            backdropFilter: 'blur(16px)',
            border: `2px solid ${isSnake ? '#ef4444' : '#22c55e'}`,
            borderRadius: '16px', px: 3, py: 1.5, textAlign: 'center',
            boxShadow: `0 0 40px ${isSnake ? '#ef444455' : '#22c55e55'}`,
          }}>
            <Typography sx={{ fontSize: '2.2rem', lineHeight: 1 }}>{isSnake ? '🐍' : '🪜'}</Typography>
            <Typography sx={{ fontWeight: 900, color: 'white', fontSize: '1.05rem', mt: 0.3 }}>
              {isSnake ? 'Snake Bite!' : 'Ladder Up!'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
              {effect.from} → {effect.to}
            </Typography>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Winner overlay ────────────────────────────────────────────────────────
function WinnerScreen({ rankings, colorMap, room, isHost, onReset, onLeave }) {
  const medals = ['🥇','🥈','🥉'];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
        <Box sx={{
          bgcolor: '#0e1520', border: '1px solid rgba(255,215,0,0.3)',
          borderRadius: '20px', p: { xs: 3, sm: 4 }, textAlign: 'center',
          maxWidth: 340, width: '90vw',
          boxShadow: '0 0 70px rgba(255,215,0,0.18)',
        }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Typography sx={{ fontSize: '3rem' }}>🏆</Typography>
          </motion.div>
          <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#ffd700', mb: 0.5 }}>
            Game Over!
          </Typography>
          <Box mt={2} mb={3}>
            {rankings.map((uid, i) => {
              const c = PLAYER_COLOR_MAP[colorMap?.[uid]];
              const n = room?.players?.[uid]?.name || uid;
              return (
                <Box key={uid} display="flex" alignItems="center" gap={1.5}
                  sx={{ mb: 1, p: 1, borderRadius: '10px',
                    bgcolor: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)' }}>
                  <Typography sx={{ fontSize: '1.3rem', width: 28 }}>{medals[i] || `${i+1}.`}</Typography>
                  <Avatar sx={{ bgcolor: c?.hex, width: 30, height: 30, fontSize: '0.85rem', fontWeight: 900 }}>
                    {n.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography sx={{ fontWeight: 800, color: i === 0 ? '#ffd700' : '#e6edf3', fontSize: '0.95rem' }}>
                    {n}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            {isHost && (
              <Button variant="contained" startIcon={<ReplayIcon />} onClick={onReset}
                sx={{ background: 'linear-gradient(135deg, #06D6A0, #118AB2)', fontWeight: 900,
                  borderRadius: '12px', px: 3 }}>
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

// ─── Main Game ─────────────────────────────────────────────────────────────
export function SnakeLadderGame() {
  const { state } = useGameContext();
  const { leave } = useRoom();
  const { room, roomId, userId } = state;
  const sl = room?.slState;

  const [rolling, setRolling]       = useState(false);
  const [moving, setMoving]         = useState(false);
  const [showEffect, setShowEffect] = useState(false);
  const effectTimerRef = useRef(null);

  const { online, confirmOpen, requestLeave, cancelLeave, confirmLeave } = useGameGuard({
    roomId, userId, gameType: 'snakeladder', leaveCallback: leave,
  });

  // Safe destructuring even if sl is null
  const {
    playerOrder = [], colorMap = {}, positions = {},
    currentTurnIndex = 0, diceValue, diceRolled,
    winner, lastEffect, rankings = [],
  } = sl || {};

  const currentPlayerId = playerOrder[currentTurnIndex];
  const isMyTurn        = currentPlayerId === userId;
  const myColorId       = colorMap[userId];
  const myColor         = PLAYER_COLOR_MAP[myColorId];
  const isHost          = room?.hostId === userId;
  const myPos           = positions[userId] || 0;
  const alreadyFinished = rankings.includes(userId);
  const currentTurnColor = PLAYER_COLOR_MAP[colorMap[currentPlayerId]];

  // Save game history once when the game ends
  const slSavedRef = useRef(false);
  useEffect(() => {
    if (!winner || !userId || !room || slSavedRef.current) return;
    slSavedRef.current = true;
    const myRank = rankings.indexOf(userId) + 1 || playerOrder.length;
    const winnerPlayer = room.players?.[winner];
    const unfinished = playerOrder.filter(uid => !rankings.includes(uid));
    const orderedUids = [...rankings, ...unfinished];
    saveGameHistory(userId, {
      gameType: 'snakeladder',
      roomId: room.id,
      myRank,
      totalPlayers: playerOrder.length,
      winnerName: winnerPlayer?.name || '',
      rankedPlayers: orderedUids.map((uid, i) => ({
        name: room.players?.[uid]?.name || uid,
        score: null,
        rank: i + 1,
        isMe: uid === userId,
      })),
    });
  }, [winner]); // eslint-disable-line

  // All hooks are now at the top level (ESLint happy)
  const handleRoll = useCallback(async () => {
    if (!isMyTurn || diceRolled || rolling || alreadyFinished) return;
    setRolling(true);
    await rollSnakeDice(roomId, userId);
    setRolling(false);
  }, [isMyTurn, diceRolled, rolling, alreadyFinished, roomId, userId]);

  const handleMove = useCallback(async () => {
    if (!isMyTurn || !diceRolled || moving) return;
    setMoving(true);
    const result = await moveSnakePiece(roomId, userId);
    setMoving(false);
    if (result?.effectType) {
      clearTimeout(effectTimerRef.current);
      setShowEffect(true);
      // Delay effect toast to show after step-by-step walk
      const steps = Math.abs((result.preEffectPos || 0) - (result.fromPos || 0));
      const delay = Math.min(steps * 180, 1200) + 400;
      effectTimerRef.current = setTimeout(() => setShowEffect(false), delay + 2000);
    }
  }, [isMyTurn, diceRolled, moving, roomId, userId]);

  const handleReset = useCallback(() => resetSnakeLadderGame(roomId), [roomId]);

  // Early return only after all hooks
  if (!sl) return null;

  // Control panel used both in sidebar and mobile bottom bar
  const ControlPanel = (
    <Box display="flex" flexDirection="column" gap={1.2} alignItems="center">
      {/* Dice display */}
      <Box sx={{
        p: 1.5, borderRadius: '14px', width: '100%',
        bgcolor: 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${isMyTurn ? (myColor?.hex + '50') : 'rgba(255,255,255,0.07)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isMyTurn ? `0 0 18px ${myColor?.hex}25` : 'none',
        transition: 'all 0.2s',
      }}>
        {diceValue ? (
          <DiceFace value={diceValue} color={myColor?.hex || '#4CC9F0'} rolling={rolling} size={62} />
        ) : (
          <Box sx={{ width: 62, height: 62, borderRadius: '12px',
            border: '2px dashed rgba(255,255,255,0.13)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CasinoIcon sx={{ color: 'rgba(255,255,255,0.18)', fontSize: '1.8rem' }} />
          </Box>
        )}
      </Box>

      {/* Action button */}
      {isMyTurn && !alreadyFinished && !winner && (
        !diceRolled ? (
          <Button fullWidth variant="contained" onClick={handleRoll} disabled={rolling}
            startIcon={rolling ? null : <CasinoIcon />}
            sx={{
              background: `linear-gradient(135deg, ${myColor?.hex || '#4CC9F0'}, ${myColor?.hex || '#4CC9F0'}bb)`,
              fontWeight: 900, borderRadius: '12px', py: 1.1, fontSize: '0.88rem',
              boxShadow: `0 4px 18px ${myColor?.hex || '#4CC9F0'}40`,
              '&:hover': { filter: 'brightness(1.12)' },
            }}>
            {rolling ? 'Rolling…' : 'Roll Dice'}
          </Button>
        ) : (
          <Button fullWidth variant="contained" onClick={handleMove} disabled={moving}
            sx={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              fontWeight: 900, borderRadius: '12px', py: 1.1, fontSize: '0.88rem',
              boxShadow: '0 4px 18px rgba(34,197,94,0.35)',
              '&:hover': { filter: 'brightness(1.1)' },
            }}>
            {moving ? 'Moving…' : `Move +${diceValue}`}
          </Button>
        )
      )}
      {(!isMyTurn || alreadyFinished) && !winner && (
        <Box sx={{ py: 0.6, px: 1.5, borderRadius: '10px', textAlign: 'center', width: '100%',
          bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#8b949e' }}>
            {alreadyFinished ? '✅ Finished!' : `Waiting for ${room?.players?.[currentPlayerId]?.name || '…'}…`}
          </Typography>
        </Box>
      )}

      {/* My cell */}
      <Box sx={{ width: '100%', py: 0.8, px: 1.2, borderRadius: '10px', textAlign: 'center',
        bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Typography sx={{ color: '#8b949e', fontSize: '0.65rem', mb: 0.2 }}>Your cell</Typography>
        <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', color: myColor?.hex || '#4CC9F0', lineHeight: 1 }}>
          {myPos === 0 ? 'Start' : myPos === 100 ? '🏆' : myPos}
        </Typography>
        {myPos > 0 && myPos < 100 && (
          <Typography sx={{ color: '#484f58', fontSize: '0.6rem' }}>{100 - myPos} to go</Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{
      height: '100dvh', bgcolor: '#080c12',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
    }}>
      <OfflineBanner online={online} />

      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: { xs: 1.5, sm: 2 }, py: { xs: 1, sm: 1.2 },
        mt: !online ? '36px' : 0, transition: 'margin 0.3s',
        bgcolor: 'rgba(14,21,32,0.96)', borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)', zIndex: 10, flexShrink: 0,
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: { xs: '1.2rem', sm: '1.4rem' } }}>🐍</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: '0.88rem', sm: '1rem' }, color: '#e6edf3' }}>
            Snake & Ladder
          </Typography>
          <Chip label={`T${sl.turnCount || 0}`} size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#8b949e', fontSize: '0.6rem', height: 20 }} />
        </Box>
        {/* Turn indicator in header for mobile */}
        {!winner && currentTurnColor && (
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 0.6 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: currentTurnColor?.hex,
              boxShadow: `0 0 6px ${currentTurnColor?.hex}` }} />
            <Typography sx={{ fontSize: '0.7rem', color: currentTurnColor?.hex, fontWeight: 800 }}>
              {isMyTurn ? 'Your turn' : `${room?.players?.[currentPlayerId]?.name || '…'}`}
            </Typography>
          </Box>
        )}
        <Box display="flex" gap={0.5}>
          {isHost && !winner && (
            <Tooltip title="Reset">
              <IconButton size="small" onClick={handleReset} sx={{ color: '#8b949e', p: '5px' }}>
                <ReplayIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Leave">
            <IconButton size="small" onClick={requestLeave} sx={{ color: '#8b949e', p: '5px' }}>
              <ExitToAppIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Body (desktop: row, mobile: column) ── */}
      <Box sx={{
        flex: 1, overflow: 'hidden',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
      }}>

        {/* Board area */}
        <Box sx={{
          flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          overflow: { xs: 'auto', md: 'hidden' },
          p: { xs: '10px 10px 6px', sm: '14px 14px 8px', md: 2 },
          gap: 1,
        }}>
          <Box sx={{ position: 'relative', width: '100%',
            maxWidth: { xs: '100%', sm: 520, md: 560 } }}>
            <SnakeLadderBoard slState={sl} room={room} />
            {/* Effect toast overlay on board */}
            <EffectToast effect={lastEffect} visible={showEffect} />
          </Box>

          {/* Turn status bar (desktop + tablet only under board) */}
          {!winner && (
            <Box sx={{
              display: { xs: 'none', md: 'block' },
              width: '100%', maxWidth: 560,
            }}>
              <motion.div key={currentTurnIndex} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                <Box sx={{
                  py: 1, px: 2, borderRadius: '12px', textAlign: 'center',
                  background: `linear-gradient(90deg, ${currentTurnColor?.hex}18, transparent)`,
                  border: `1px solid ${currentTurnColor?.hex}35`,
                }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: currentTurnColor?.hex }}>
                    {isMyTurn
                      ? diceRolled ? `You rolled ${diceValue} — press Move!` : `Your turn — Roll the dice!`
                      : `${room?.players?.[currentPlayerId]?.name || '…'}'s turn`}
                  </Typography>
                </Box>
              </motion.div>
            </Box>
          )}
        </Box>

        {/* ── Desktop Sidebar ── */}
        <Box sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column', gap: 1.5,
          width: 200, flexShrink: 0,
          p: '14px 14px 14px 0',
          overflowY: 'auto',
        }}>
          <Typography sx={{ color: '#484f58', fontWeight: 800, fontSize: '0.65rem',
            textTransform: 'uppercase', letterSpacing: '0.1em' }}>Players</Typography>
          {playerOrder.map(uid => (
            <PlayerRow key={uid} uid={uid}
              name={room?.players?.[uid]?.name || uid}
              pos={positions[uid] || 0}
              colorId={colorMap[uid]}
              isCurrentTurn={uid === currentPlayerId && !winner}
              isMe={uid === userId}
              rank={rankings.indexOf(uid) + 1} />
          ))}
          <Box sx={{ mt: 0.5 }}>{ControlPanel}</Box>
          {/* Legend */}
          <Box sx={{ p: 1.2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)', mt: 0.5 }}>
            <Typography sx={{ fontSize: '0.65rem', color: '#484f58', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>Legend</Typography>
            <Box display="flex" alignItems="center" gap={0.8} mb={0.4}>
              <Typography sx={{ fontSize: '0.85rem' }}>🪜</Typography>
              <Typography sx={{ color: '#86efac', fontSize: '0.7rem', fontWeight: 700 }}>Climb up</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.8}>
              <Typography sx={{ fontSize: '0.85rem' }}>🐍</Typography>
              <Typography sx={{ color: '#fca5a5', fontSize: '0.7rem', fontWeight: 700 }}>Slide down</Typography>
            </Box>
          </Box>
        </Box>

        {/* ── Mobile Bottom Panel ── */}
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          flexDirection: 'column',
          flexShrink: 0,
          bgcolor: 'rgba(10,16,26,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          px: 1.5, pt: 1.2, pb: 'max(12px, env(safe-area-inset-bottom))',
        }}>
          {/* Scrollable player chips row */}
          <Box sx={{ display: 'flex', gap: 0.8, overflowX: 'auto', pb: 1,
            scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            {playerOrder.map(uid => {
              const c = PLAYER_COLOR_MAP[colorMap[uid]];
              const pos = positions[uid] || 0;
              const isCur = uid === currentPlayerId && !winner;
              const rank = rankings.indexOf(uid) + 1;
              return (
                <Box key={uid} sx={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.6,
                  px: 1, py: 0.6, borderRadius: '20px',
                  border: `1.5px solid ${isCur ? c?.hex : 'rgba(255,255,255,0.08)'}`,
                  bgcolor: isCur ? `${c?.hex}14` : 'rgba(255,255,255,0.03)',
                  boxShadow: isCur ? `0 0 10px ${c?.hex}30` : 'none',
                }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: c?.hex, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 800,
                    color: isCur ? c?.hex : '#8b949e', whiteSpace: 'nowrap' }}>
                    {uid === userId ? 'You' : room?.players?.[uid]?.name || uid}
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: '#484f58', fontWeight: 700 }}>
                    {rank > 0 ? `#${rank}` : pos || 'S'}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Dice + button row */}
          <Box display="flex" alignItems="center" gap={1.5}>
            {/* Dice */}
            <Box sx={{
              flexShrink: 0, p: 1, borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${isMyTurn && diceValue ? (myColor?.hex + '60') : 'rgba(255,255,255,0.08)'}`,
            }}>
              {diceValue ? (
                <DiceFace value={diceValue} color={myColor?.hex || '#4CC9F0'} rolling={rolling} size={50} />
              ) : (
                <Box sx={{ width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CasinoIcon sx={{ color: 'rgba(255,255,255,0.15)', fontSize: '1.6rem' }} />
                </Box>
              )}
            </Box>

            {/* Action */}
            <Box flex={1}>
              {isMyTurn && !alreadyFinished && !winner && (
                !diceRolled ? (
                  <Button fullWidth variant="contained" onClick={handleRoll} disabled={rolling}
                    sx={{
                      background: `linear-gradient(135deg, ${myColor?.hex || '#4CC9F0'}, ${myColor?.hex || '#4CC9F0'}bb)`,
                      fontWeight: 900, borderRadius: '12px', py: 1.2, fontSize: '0.9rem',
                      boxShadow: `0 4px 16px ${myColor?.hex || '#4CC9F0'}40`,
                    }}>
                    {rolling ? 'Rolling…' : '🎲 Roll'}
                  </Button>
                ) : (
                  <Button fullWidth variant="contained" onClick={handleMove} disabled={moving}
                    sx={{
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      fontWeight: 900, borderRadius: '12px', py: 1.2, fontSize: '0.9rem',
                      boxShadow: '0 4px 16px rgba(34,197,94,0.35)',
                    }}>
                    {moving ? 'Moving…' : `Move +${diceValue}`}
                  </Button>
                )
              )}
              {(!isMyTurn || alreadyFinished) && !winner && (
                <Box sx={{ py: 1.2, px: 2, borderRadius: '12px', textAlign: 'center',
                  bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#8b949e' }}>
                    {alreadyFinished ? '✅ You finished!' : `Waiting for ${room?.players?.[currentPlayerId]?.name || '…'}`}
                  </Typography>
                </Box>
              )}
              {winner && (
                <Box sx={{ py: 1.2, px: 2, borderRadius: '12px', textAlign: 'center',
                  bgcolor: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#ffd700', fontWeight: 800 }}>
                    🏆 Game Over!
                  </Typography>
                </Box>
              )}
            </Box>

            {/* My pos chip */}
            <Box sx={{ flexShrink: 0, textAlign: 'center',
              px: 1, py: 0.6, borderRadius: '10px',
              bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Typography sx={{ fontSize: '0.58rem', color: '#484f58' }}>Cell</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: myColor?.hex || '#4CC9F0', lineHeight: 1 }}>
                {myPos === 0 ? 'S' : myPos}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Winner overlay */}
      <AnimatePresence>
        {winner && (
          <WinnerScreen rankings={rankings} colorMap={colorMap} room={room}
            isHost={isHost} onReset={handleReset} onLeave={requestLeave} />
        )}
      </AnimatePresence>

      <LeaveConfirmModal open={confirmOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </Box>
  );
}
// src/games/minigolf/MiniGolfGame.js
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Button, Avatar, Chip, LinearProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import ReplayIcon from '@mui/icons-material/Replay';
import GolfCourseIcon from '@mui/icons-material/GolfCourse';
import { useGameContext } from '../../context/GameContext';
import { useRoom } from '../../hooks/useRoom';
import { useGameGuard } from '../../hooks/useGameSession';
import { OfflineBanner, LeaveConfirmModal } from '../../components/GameSharedUI';
import {
  BOARD_W, BOARD_H, BALL_R, HOLE_R, MAX_POWER, MAX_STROKES,
  HOLES, BALL_COLORS, stepBall,
} from './minigolfConstants';
import { endShot, resetMiniGolfGame } from './minigolfFirebaseService';

// ─── Drawing helpers ───────────────────────────────────────────────────────
const WALL_COLOR = '#5d4037';
const WALL_HL    = '#795548';

function drawScene(ctx, hole, balls, playerOrder, playerColors, userId, aimState, holeFinished) {
  const { walls, hole: holePos, bg } = hole;

  // Background / fairway
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  // Subtle grid texture
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= BOARD_W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,BOARD_H); ctx.stroke(); }
  for (let y = 0; y <= BOARD_H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(BOARD_W,y); ctx.stroke(); }

  // Board border
  ctx.strokeStyle = WALL_COLOR;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, BOARD_W - 6, BOARD_H - 6);

  // Walls
  for (const w of walls) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(w.x + 3, w.y + 3, w.w, w.h);
    // Body
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    // Highlight
    ctx.fillStyle = WALL_HL;
    ctx.fillRect(w.x, w.y, w.w, 3);
    ctx.fillRect(w.x, w.y, 3, w.h);
  }

  // Hole shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.arc(holePos.x + 2, holePos.y + 2, HOLE_R, 0, Math.PI * 2); ctx.fill();
  // Hole
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(holePos.x, holePos.y, HOLE_R, 0, Math.PI * 2); ctx.fill();
  // Hole rim
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(holePos.x, holePos.y, HOLE_R, 0, Math.PI * 2); ctx.stroke();
  // Flag
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(holePos.x, holePos.y - HOLE_R); ctx.lineTo(holePos.x, holePos.y - HOLE_R - 18); ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.moveTo(holePos.x, holePos.y - HOLE_R - 18); ctx.lineTo(holePos.x + 12, holePos.y - HOLE_R - 12); ctx.lineTo(holePos.x, holePos.y - HOLE_R - 6); ctx.fill();

  // Aim arrow (current player only, not animating)
  if (aimState && aimState.show) {
    const { bx, by, angle, power } = aimState;
    // Draw arrow pointing in the SHOT direction (opposite to drag)
    const shotAngle = angle + Math.PI;
    const arrowLen = 20 + power * 1.8;
    const ex = bx + Math.cos(shotAngle) * arrowLen;
    const ey = by + Math.sin(shotAngle) * arrowLen;

    // Power colour
    const pct = power / MAX_POWER;
    const r = Math.round(255 * pct);
    const g = Math.round(255 * (1 - pct));
    const arrowColor = `rgba(${r},${g},50,0.85)`;

    ctx.save();
    ctx.strokeStyle = arrowColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    // arrowhead
    ctx.fillStyle = arrowColor;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(shotAngle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, 5); ctx.lineTo(-7, -5); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // Balls (sunk players greyed out / not shown on board)
  playerOrder.forEach((uid, idx) => {
    if (holeFinished?.includes(uid)) return;  // already sunk this hole
    const b = balls[uid];
    if (!b) return;
    const color = playerColors[uid] || BALL_COLORS[idx % BALL_COLORS.length];
    const isMe = uid === userId;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(b.x + 2, b.y + 2, BALL_R, 0, Math.PI * 2); ctx.fill();

    // Ball body
    const grad = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, shadeColor(color, -40));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();

    // Outline for active player
    if (isMe) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R + 2, 0, Math.PI * 2); ctx.stroke();
    }
  });
}

function shadeColor(hex, amt) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// ─── WinnerOverlay ─────────────────────────────────────────────────────────
function WinnerOverlay({ u, room, isHost, playerColors, onReset, onLeave }) {
  const playerOrder = u.playerOrder || [];
  const scores = u.scores || {};
  const totals = playerOrder.map(uid => ({
    uid,
    name: room.players?.[uid]?.name || uid,
    total: (scores[uid] || []).reduce((s, v) => s + v, 0),
    color: playerColors[uid] || '#fff',
  })).sort((a, b) => a.total - b.total);
  const medals = ['🥇','🥈','🥉'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
        <Box sx={{ bgcolor: '#0e1520', border: '1px solid rgba(255,215,0,0.3)',
          borderRadius: '20px', p: { xs: 3, sm: 4 }, textAlign: 'center',
          maxWidth: 360, width: '90vw', boxShadow: '0 0 70px rgba(255,215,0,0.18)' }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Typography sx={{ fontSize: '3rem' }}>🏆</Typography>
          </motion.div>
          <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#ffd700', mb: 0.5 }}>
            Game Over!
          </Typography>
          <Typography sx={{ color: '#8b949e', fontSize: '0.8rem', mb: 2 }}>
            Lowest strokes wins
          </Typography>
          <Box mb={3}>
            {totals.map((p, i) => (
              <Box key={p.uid} display="flex" alignItems="center" gap={1.5}
                sx={{ mb: 1, p: 1, borderRadius: '10px',
                  bgcolor: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)' }}>
                <Typography sx={{ fontSize: '1.3rem', width: 28 }}>{medals[i] || `${i+1}.`}</Typography>
                <Avatar sx={{ bgcolor: p.color, width: 30, height: 30, fontSize: '0.85rem', fontWeight: 900,
                  border: '2px solid rgba(255,255,255,0.2)' }}>
                  {p.name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography sx={{ fontWeight: 800, color: i === 0 ? '#ffd700' : '#e6edf3',
                  fontSize: '0.95rem', flex: 1, textAlign: 'left' }}>
                  {p.name}
                </Typography>
                <Chip label={`${p.total} strokes`} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#e6edf3', fontSize: '0.7rem' }} />
              </Box>
            ))}
          </Box>
          <Box display="flex" gap={1} justifyContent="center">
            {isHost && (
              <Button variant="contained" startIcon={<ReplayIcon />} onClick={onReset}
                sx={{ background: 'linear-gradient(135deg,#06D6A0,#118AB2)',
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

// ─── Scoreboard sidebar ────────────────────────────────────────────────────
function Scoreboard({ u, room, playerColors }) {
  const playerOrder = u.playerOrder || [];
  const scores = u.scores || {};
  const holeCount = HOLES.length;
  return (
    <Box sx={{ bgcolor: 'rgba(0,0,0,0.55)', borderRadius: 2, p: 1.5,
      border: '1px solid rgba(255,255,255,0.08)', minWidth: 180 }}>
      <Typography sx={{ color: '#ffd700', fontWeight: 900, fontSize: '0.78rem',
        mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <GolfCourseIcon sx={{ fontSize: 14 }} /> Scorecard
      </Typography>
      {/* Header */}
      <Box display="flex" gap={0.5} mb={0.5}>
        <Typography sx={{ color: '#8b949e', fontSize: '0.65rem', width: 70 }}>Player</Typography>
        {HOLES.map((_, i) => (
          <Typography key={i} sx={{ color: '#8b949e', fontSize: '0.65rem', width: 20, textAlign: 'center' }}>
            {i + 1}
          </Typography>
        ))}
        <Typography sx={{ color: '#8b949e', fontSize: '0.65rem', width: 28, textAlign: 'right' }}>Tot</Typography>
      </Box>
      {playerOrder.map((uid) => {
        const name = room.players?.[uid]?.name || uid;
        const s = scores[uid] || [];
        const total = s.reduce((acc, v) => acc + v, 0);
        return (
          <Box key={uid} display="flex" gap={0.5} alignItems="center" mb={0.3}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: playerColors[uid] || '#fff', flexShrink: 0 }} />
            <Typography sx={{ color: '#e6edf3', fontSize: '0.68rem', width: 62,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </Typography>
            {Array.from({ length: holeCount }).map((_, i) => (
              <Typography key={i} sx={{ color: s[i] != null ? '#facc15' : '#555',
                fontSize: '0.68rem', width: 20, textAlign: 'center', fontWeight: 700 }}>
                {s[i] ?? '–'}
              </Typography>
            ))}
            <Typography sx={{ color: total > 0 ? '#fff' : '#555', fontSize: '0.7rem',
              width: 28, textAlign: 'right', fontWeight: 900 }}>
              {total > 0 ? total : '–'}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Main game component ───────────────────────────────────────────────────
export function MiniGolfGame() {
  const { state } = useGameContext();
  const { leave } = useRoom();
  const { room, userId, roomId } = state;
  const u = room?.miniGolfState;

  const { online, confirmOpen, requestLeave, cancelLeave, confirmLeave } = useGameGuard({
    roomId, userId, gameType: 'minigolf', leaveCallback: leave,
  });

  const canvasRef = useRef(null);
  const aimRef    = useRef({ show: false, bx: 0, by: 0, angle: 0, power: 0 });
  const ballsRef  = useRef({});   // local mutable copy for animation
  const rafRef    = useRef(null);

  const [animating, setAnimating] = useState(false);
  const [localStrokes, setLocalStrokes] = useState(0);
  const [shotMsg, setShotMsg] = useState('');
  const [powerPct, setPowerPct] = useState(0);

  const isMyTurn  = u && u.playerOrder?.[u.currentIndex] === userId;
  const holeData  = u ? (HOLES[u.currentHoleIdx] || HOLES[0]) : HOLES[0];
  const holeFinished = useMemo(() => u?.holeFinished || [], [u?.holeFinished]);
  const iAlreadySunk = holeFinished.includes(userId);

  // ── Assign stable colours to players ──────────────────────────────────
  const playerColors = useMemo(() => {
    const colors = {};
    if (u?.playerOrder) {
      u.playerOrder.forEach((uid, i) => {
        colors[uid] = BALL_COLORS[i % BALL_COLORS.length];
      });
    }
    return colors;
  }, [u?.playerOrder]);

  // ── Sync firebase ball positions into local ref ──────────────────────
  useEffect(() => {
    if (!u?.balls) return;
    if (animating) return;  // don't overwrite while animating
    ballsRef.current = JSON.parse(JSON.stringify(u.balls));
  }, [u?.balls, animating]);

  // ── Reset local strokes when hole changes ─────────────────────────────
  useEffect(() => {
    if (!u) return;
    const b = u.balls?.[userId];
    setLocalStrokes(b?.strokes ?? 0);
    setShotMsg('');
  }, [u?.currentHoleIdx, userId, u]);

  // ── Canvas draw loop ──────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !u) return;
    const ctx = canvas.getContext('2d');
    drawScene(
      ctx, holeData,
      ballsRef.current,
      u.playerOrder || [],
      playerColors,
      userId,
      animating ? null : (isMyTurn && !iAlreadySunk ? aimRef.current : null),
      holeFinished,
    );
  }, [u, holeData, animating, isMyTurn, iAlreadySunk, holeFinished, playerColors, userId]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // ── Physics animation loop ──────────────────────────────────────────
  const runPhysics = useCallback((uid, strokes) => {
    const { walls, hole: holePos } = holeData;
    const ball = ballsRef.current[uid];
    if (!ball) return;

    let currentStrokes = strokes;

    const tick = () => {
      const result = stepBall(ball, holePos, walls);
      redraw();

      if (result === 'moving') {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Ball stopped or sunk
      setAnimating(false);
      const wasSunk = result === 'sunk';
      if (wasSunk) {
        setShotMsg('⛳ In the hole!');
      } else if (currentStrokes >= MAX_STROKES) {
        setShotMsg(`⛳ Max strokes! (${currentStrokes})`);
      } else {
        setShotMsg('');
      }

      // Push to Firebase
      endShot(roomId, uid, ball.x, ball.y, currentStrokes, wasSunk || currentStrokes >= MAX_STROKES)
        .catch(console.error);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [holeData, redraw, roomId]);

  // ── Pointer aim handling ─────────────────────────────────────────────
  const getCanvasXY = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = BOARD_W / rect.width;
    const scaleY = BOARD_H / rect.height;
    const src    = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    };
  };

  const handlePointerDown = (e) => {
    if (!isMyTurn || animating || iAlreadySunk) return;
    e.preventDefault();
    const { x, y } = getCanvasXY(e);
    const ball = ballsRef.current[userId];
    if (!ball) return;
    const angle = Math.atan2(y - ball.y, x - ball.x);
    const dist  = Math.min(Math.hypot(x - ball.x, y - ball.y), MAX_POWER * 5);
    const power = Math.min(dist / 5, MAX_POWER);
    aimRef.current = { show: true, bx: ball.x, by: ball.y, angle, power };
    setPowerPct(power / MAX_POWER);
    redraw();
  };

  const handlePointerMove = (e) => {
    if (!aimRef.current.show) return;
    e.preventDefault();
    const { x, y } = getCanvasXY(e);
    const ball = ballsRef.current[userId];
    if (!ball) return;
    const angle = Math.atan2(y - ball.y, x - ball.x);
    const dist  = Math.min(Math.hypot(x - ball.x, y - ball.y), MAX_POWER * 5);
    const power = Math.min(dist / 5, MAX_POWER);
    aimRef.current = { show: true, bx: ball.x, by: ball.y, angle, power };
    setPowerPct(power / MAX_POWER);
    redraw();
  };

  const handlePointerUp = (e) => {
    if (!aimRef.current.show) return;
    e.preventDefault();
    const { angle, power } = aimRef.current;
    aimRef.current = { show: false };
    setPowerPct(0);
    if (power < 0.5) return;  // tap with no drag → ignore

    const ball = ballsRef.current[userId];
    if (!ball) return;
    ball.vx = -Math.cos(angle) * power;
    ball.vy = -Math.sin(angle) * power;
    const newStrokes = localStrokes + 1;
    setLocalStrokes(newStrokes);
    setAnimating(true);
    setShotMsg('');
    runPhysics(userId, newStrokes);
  };

  // Cleanup RAF on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // ── Guard: not ready yet ─────────────────────────────────────────────
  if (!room || !u || !u.playerOrder) return null;

  const currentPlayerName = room.players?.[u.playerOrder?.[u.currentIndex]]?.name || '...';

  return (
    <Box sx={{ height: '100dvh', bgcolor: '#080c12', display: 'flex',
      flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>

      {/* ── Top bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, bgcolor: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, flexWrap: 'wrap', gap: 1 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <GolfCourseIcon sx={{ color: '#4ade80', fontSize: 20 }} />
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '0.95rem' }}>
            {holeData.name}
          </Typography>
          <Chip label={`Par ${holeData.par}`} size="small"
            sx={{ bgcolor: 'rgba(255,215,0,0.15)', color: '#ffd700', fontSize: '0.7rem', fontWeight: 800 }} />
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            label={iAlreadySunk
              ? '✅ Hole done!'
              : isMyTurn
                ? `Your turn • ${localStrokes}/${MAX_STROKES} shots`
                : `${currentPlayerName}'s turn`}
            size="small"
            sx={{
              bgcolor: isMyTurn && !iAlreadySunk ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.07)',
              color: isMyTurn && !iAlreadySunk ? '#4ade80' : '#8b949e',
              fontWeight: 800, fontSize: '0.72rem',
            }}
          />
          <Typography sx={{ color: '#8b949e', fontSize: '0.72rem' }}>
            {u.currentHoleIdx + 1}/{HOLES.length}
          </Typography>
        </Box>
      </Box>

      {/* ── Power bar (visible while aiming) ── */}
      <AnimatePresence>
        {powerPct > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Box sx={{ px: 2, py: 0.5, bgcolor: 'rgba(0,0,0,0.4)' }}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography sx={{ color: '#8b949e', fontSize: '0.65rem', width: 40 }}>Power</Typography>
                <LinearProgress variant="determinate" value={powerPct * 100}
                  sx={{ flex: 1, height: 6, borderRadius: 3,
                    '& .MuiLinearProgress-bar': {
                      background: `linear-gradient(90deg, #22c55e, ${powerPct > 0.7 ? '#ef4444' : '#facc15'})`,
                    } }} />
                <Typography sx={{ color: '#fff', fontSize: '0.65rem', width: 30, textAlign: 'right', fontWeight: 700 }}>
                  {Math.round(powerPct * 100)}%
                </Typography>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main area: canvas + scoreboard ── */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 2, px: 1, overflow: 'hidden' }}>

        {/* Canvas wrapper — aspect ratio preserved */}
        <Box sx={{ position: 'relative', flex: '0 1 auto',
          aspectRatio: `${BOARD_W} / ${BOARD_H}`,
          maxWidth: '100%', maxHeight: '100%',
          width: '100%', borderRadius: 2, overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          border: '2px solid rgba(255,255,255,0.08)',
          cursor: isMyTurn && !iAlreadySunk && !animating ? 'crosshair' : 'default',
        }}>
          <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H}
            style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
          {/* Shot message overlay */}
          <AnimatePresence>
            {shotMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.75)', color: '#4ade80', fontWeight: 900,
                  padding: '4px 14px', borderRadius: 20, fontSize: '0.85rem',
                  backdropFilter: 'blur(4px)', whiteSpace: 'nowrap',
                  border: '1px solid rgba(74,222,128,0.3)' }}>
                {shotMsg}
              </motion.div>
            )}
          </AnimatePresence>
          {/* "It's your turn" prompt */}
          {isMyTurn && !iAlreadySunk && !animating && powerPct === 0 && (
            <Box sx={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              bgcolor: 'rgba(0,0,0,0.65)', px: 2, py: 0.6, borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
              <Typography sx={{ color: '#8b949e', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                Click &amp; drag to aim · release to shoot
              </Typography>
            </Box>
          )}
        </Box>

        {/* Scoreboard — hidden on very small screens */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0 }}>
          <Scoreboard u={u} room={room} playerColors={playerColors} />
        </Box>
      </Box>

      {/* ── Bottom bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, bgcolor: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0 }}>
        {/* Mobile scoreboard toggle */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, flexWrap: 'wrap' }}>
          {u.playerOrder?.map((uid, i) => {
            const total = (u.scores?.[uid] || []).reduce((s, v) => s + v, 0);
            return (
              <Chip key={uid} size="small"
                avatar={<Avatar sx={{ bgcolor: playerColors[uid], width: 18, height: 18, fontSize: '0.55rem' }}>
                  {room.players?.[uid]?.name?.charAt(0)}
                </Avatar>}
                label={total || '0'}
                sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: '#e6edf3',
                  fontSize: '0.68rem', height: 22 }}
              />
            );
          })}
        </Box>
        <Button size="small" variant="outlined" startIcon={<ExitToAppIcon sx={{ fontSize: 14 }} />}
          onClick={requestLeave}
          sx={{ ml: 'auto', fontWeight: 700, fontSize: '0.7rem', py: 0.4, px: 1.5,
            borderRadius: 2, borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444',
            '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
          Leave
        </Button>
      </Box>

      <OfflineBanner online={online} />

      {/* ── Winner overlay ── */}
      <AnimatePresence>
        {u.winner && (
          <WinnerOverlay u={u} room={room} isHost={state.isHost} playerColors={playerColors}
            onReset={() => resetMiniGolfGame(roomId, u.playerOrder)}
            onLeave={requestLeave} />
        )}
      </AnimatePresence>

      <LeaveConfirmModal open={confirmOpen} onCancel={cancelLeave} onConfirm={confirmLeave} />
    </Box>
  );
}
// src/games/solo/FlappyBirdGame.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { saveSoloScore, getLocalSoloBest } from '../../firebase/services';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 360;
const H = 600;

const BIRD_X = 80;
const BIRD_R = 16;

// Physics tuned for ~60fps — feels like classic Flappy Bird
const GRAVITY    = 0.22;   // gentle pull each frame
const FLAP_FORCE = -6.0;   // upward kick on tap
const MAX_VEL    = 9;      // terminal velocity cap

const PIPE_WIDTH   = 56;
const PIPE_GAP     = 165;   // vertical opening between pipes
const PIPE_SPEED   = 2.4;
const PIPE_INTERVAL = 1700; // ms between pipe spawns (time-based)

const GROUND_H = 56;
const SKY_H    = H - GROUND_H;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randomGapY() {
  const minY = 90;
  const maxY = SKY_H - PIPE_GAP - 90;
  return minY + Math.random() * (maxY - minY);
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawBackground(ctx, bgOffset) {
  const grad = ctx.createLinearGradient(0, 0, 0, SKY_H);
  grad.addColorStop(0, '#0d1b2a');
  grad.addColorStop(1, '#1b3a5c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, SKY_H);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  [[30,40],[80,20],[150,60],[220,30],[290,50],[340,25],[60,90],[180,80],[310,85]].forEach(([sx,sy]) => {
    ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  [{ ox: 0, y: 100, rw: 80, rh: 28 }, { ox: 170, y: 160, rw: 60, rh: 22 }, { ox: 70, y: 230, rw: 100, rh: 32 }]
    .forEach(c => {
      const x = ((bgOffset * 0.3 + c.ox) % (W + 120)) - 60;
      ctx.beginPath(); ctx.ellipse(x, c.y, c.rw / 2, c.rh / 2, 0, 0, Math.PI * 2); ctx.fill();
    });
}

function drawGround(ctx, groundOffset) {
  const gGrad = ctx.createLinearGradient(0, SKY_H, 0, H);
  gGrad.addColorStop(0,   '#2d5a27');
  gGrad.addColorStop(0.3, '#3a7233');
  gGrad.addColorStop(1,   '#1a3a18');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, SKY_H, W, GROUND_H);
  ctx.fillStyle = '#4a9a40';
  ctx.fillRect(0, SKY_H, W, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 10; i++) {
    const x = ((groundOffset + i * 38) % W);
    ctx.beginPath(); ctx.ellipse(x, SKY_H + 20, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPipe(ctx, x, gapY) {
  const topH = gapY;
  const botY = gapY + PIPE_GAP;
  const botH = SKY_H - botY;
  const r = 6;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 4, 0, PIPE_WIDTH, topH);
  ctx.fillRect(x + 4, botY, PIPE_WIDTH, botH);

  const pGrad = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  pGrad.addColorStop(0,    '#2d8a3e');
  pGrad.addColorStop(0.35, '#3daa50');
  pGrad.addColorStop(0.6,  '#48c060');
  pGrad.addColorStop(1,    '#1a5c26');
  ctx.fillStyle = pGrad;

  ctx.fillRect(x, 0, PIPE_WIDTH, topH - 14);
  ctx.beginPath(); ctx.roundRect(x - 5, topH - 20, PIPE_WIDTH + 10, 20, [0,0,r,r]); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x - 5, botY, PIPE_WIDTH + 10, 20, [r,r,0,0]); ctx.fill();
  ctx.fillRect(x, botY + 14, PIPE_WIDTH, botH - 14);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 8, 0, 10, topH - 14);
  ctx.fillRect(x + 8, botY + 14, 10, botH - 14);
}

function drawBird(ctx, y, vel, wobble) {
  const angle = Math.max(-0.5, Math.min(1.3, vel * 0.07));
  ctx.save();
  ctx.translate(BIRD_X, y);
  ctx.rotate(angle);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(2, BIRD_R + 2, BIRD_R * 0.8, 5, 0, 0, Math.PI * 2); ctx.fill();

  const bodyGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, BIRD_R + 2);
  bodyGrad.addColorStop(0,   '#FFE566');
  bodyGrad.addColorStop(0.6, '#FFD166');
  bodyGrad.addColorStop(1,   '#e6a800');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();

  const wingY = Math.sin(wobble * 0.35) * 5;
  ctx.fillStyle = '#e6a800';
  ctx.beginPath(); ctx.ellipse(-4, wingY, 10, 6, -0.4, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(7, -5, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(8, -5, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(9, -6, 1.2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#FF9F1C';
  ctx.beginPath(); ctx.moveTo(BIRD_R, -2); ctx.lineTo(BIRD_R + 10, 0); ctx.lineTo(BIRD_R, 4); ctx.closePath(); ctx.fill();

  ctx.fillStyle = 'rgba(255,140,140,0.35)';
  ctx.beginPath(); ctx.ellipse(5, 4, 5, 3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawScoreOnCanvas(ctx, score) {
  ctx.font = 'bold 38px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText(String(score), W / 2 + 2, 62);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(String(score), W / 2, 60);
  ctx.textAlign = 'left';
}

// ─── Component ────────────────────────────────────────────────────────────────
export function FlappyBirdGame({ onExit, userId, playerName }) {
  const canvasRef   = useRef(null);
  const stateRef    = useRef(null);
  const animRef     = useRef(null);
  const idleRef     = useRef(null);
  const idleTick    = useRef(0);
  const lastPipeTs  = useRef(0);

  const [score,      setScore]      = useState(0);
  const [gameStatus, setGameStatus] = useState('idle');
  const [bestScore,  setBestScore]  = useState(() => getLocalSoloBest(userId, 'flappy'));

  // ── Idle canvas: bird bobs in place ─────────────────────────────────────────
  useEffect(() => {
    if (gameStatus !== 'idle') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      idleTick.current++;
      const bobY = H / 2 - 40 + Math.sin(idleTick.current * 0.05) * 10;
      drawBackground(ctx, idleTick.current * 0.5);
      drawGround(ctx, (idleTick.current * PIPE_SPEED) % W);
      drawBird(ctx, bobY, 0, idleTick.current);
      idleRef.current = requestAnimationFrame(loop);
    };
    idleRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(idleRef.current);
  }, [gameStatus]);

  // ── Init ────────────────────────────────────────────────────────────────────
  const initState = useCallback(() => ({
    birdY:        H / 2 - 40,
    birdVel:      -2.5,   // slight upward nudge on start — gives player time to react
    pipes:        [],
    groundOffset: 0,
    bgOffset:     0,
    score:        0,
    wobble:       0,
    dead:         false,
  }), []);

  // ── Flap ────────────────────────────────────────────────────────────────────
  const flap = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.dead) return;
    s.birdVel = FLAP_FORCE;
    s.wobble  = 0;
  }, []);

  // ── Start ───────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    cancelAnimationFrame(idleRef.current);
    stateRef.current = initState();
    // Delay first pipe so player has ~1.2 s to find their rhythm
    lastPipeTs.current = performance.now() + 1200;
    setScore(0);
    setGameStatus('playing');
  }, [initState]);

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === ' ') {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameStatus, flap]);

  // ── Game loop ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');

    const loop = (now) => {
      const s = stateRef.current;
      if (!s) return;

      s.wobble++;
      s.bgOffset     += PIPE_SPEED * 0.4;
      s.groundOffset  = (s.groundOffset + PIPE_SPEED) % W;

      if (!s.dead) {
        // Physics
        s.birdVel = Math.min(s.birdVel + GRAVITY, MAX_VEL);
        s.birdY  += s.birdVel;

        // Pipe spawn (time-based)
        if (now - lastPipeTs.current >= PIPE_INTERVAL) {
          lastPipeTs.current = now;
          s.pipes.push({ x: W + 10, gapY: randomGapY(), scored: false });
        }

        // Move & cull pipes
        s.pipes.forEach(p => { p.x -= PIPE_SPEED; });
        s.pipes = s.pipes.filter(p => p.x > -PIPE_WIDTH - 20);

        // Score
        s.pipes.forEach(p => {
          if (!p.scored && p.x + PIPE_WIDTH < BIRD_X - BIRD_R) {
            p.scored = true;
            s.score++;
            setScore(s.score);
          }
        });

        // Collision hitbox (slightly smaller than visual for fairness)
        const bTop   = s.birdY - BIRD_R + 4;
        const bBot   = s.birdY + BIRD_R - 4;
        const bLeft  = BIRD_X  - BIRD_R + 5;
        const bRight = BIRD_X  + BIRD_R - 5;

        if (bBot >= SKY_H || bTop <= 0) s.dead = true;

        if (!s.dead) {
          for (const p of s.pipes) {
            const inX = bRight > p.x && bLeft < p.x + PIPE_WIDTH;
            const inY = bTop < p.gapY || bBot > p.gapY + PIPE_GAP;
            if (inX && inY) { s.dead = true; break; }
          }
        }

        if (s.dead) {
          const finalScore = s.score;
          setGameStatus('dead');
          saveSoloScore(userId, playerName, 'flappy', finalScore);
          setBestScore(prev => Math.max(prev, finalScore));
        }
      } else {
        // Death fall
        if (s.birdY < SKY_H - BIRD_R) {
          s.birdVel = Math.min(s.birdVel + GRAVITY * 1.6, MAX_VEL * 1.5);
          s.birdY  += s.birdVel;
        }
      }

      // Draw
      drawBackground(ctx, s.bgOffset);
      s.pipes.forEach(p => drawPipe(ctx, p.x, p.gapY));
      drawGround(ctx, s.groundOffset);
      drawBird(ctx, s.birdY, s.birdVel, s.wobble);
      if (!s.dead) drawScoreOnCanvas(ctx, s.score);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameStatus, userId, playerName]);

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    cancelAnimationFrame(idleRef.current);
  }, []);

  const accentColor = '#06D6A0';
  const accentGrad  = 'linear-gradient(135deg, #06D6A0 0%, #4CC9F0 100%)';

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #080c12 0%, #0a1520 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <Box sx={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', top: '-60px', left: '-60px',
        background: 'radial-gradient(circle, #06D6A015, transparent 70%)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', bottom: '6%', right: '-50px',
        background: 'radial-gradient(circle, #4CC9F010, transparent 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <Box sx={{ width: W, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2, px: 0.5 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onExit} size="small"
          sx={{ color: '#484f58', fontSize: '0.72rem', fontWeight: 700, minWidth: 0, px: 1, borderRadius: '10px',
            '&:hover': { color: accentColor, bgcolor: 'rgba(6,214,160,0.08)' } }}>
          Back
        </Button>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.6,
          borderRadius: '20px', background: 'rgba(6,214,160,0.08)',
          border: '1px solid rgba(6,214,160,0.22)',
        }}>
          <Typography sx={{ fontSize: '0.85rem' }}>🐦</Typography>
          <Typography sx={{ color: '#06D6A0', fontWeight: 900, fontSize: '1rem', fontFamily: 'monospace', lineHeight: 1 }}>
            {score}
          </Typography>
          {bestScore > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Box sx={{ width: 1, height: 14, bgcolor: 'rgba(255,255,255,0.1)' }} />
              <Typography sx={{ color: '#484f58', fontWeight: 700, fontSize: '0.62rem', fontFamily: 'monospace' }}>
                BEST {bestScore}
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ width: 60 }} />
      </Box>

      {/* Canvas */}
      <Box sx={{ position: 'relative', borderRadius: '16px', boxShadow: '0 0 60px rgba(6,214,160,0.07)' }}>
        <Box sx={{
          position: 'absolute', top: -2, left: 0, right: 0, height: 3, zIndex: 1,
          background: 'linear-gradient(90deg, #06D6A0, #4CC9F0, #FFD166)',
          borderRadius: '16px 16px 0 0',
        }} />

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ borderRadius: 16, border: '1px solid rgba(6,214,160,0.15)', display: 'block', cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.preventDefault();
            if (gameStatus === 'playing') flap();
            else start();
          }}
        />

        {/* Idle overlay — semi-transparent so animated bird shows through */}
        {gameStatus === 'idle' && (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
            background: 'rgba(8,12,18,0.78)', backdropFilter: 'blur(5px)',
            pointerEvents: 'none',
          }}>
            <Box sx={{
              width: 80, height: 80, borderRadius: '22px', mb: 2,
              background: 'linear-gradient(135deg, #06D6A022, #4CC9F022)',
              border: '1px solid rgba(6,214,160,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8rem',
            }}>🐦</Box>
            <Typography sx={{
              fontWeight: 900, fontSize: '1.7rem', mb: 0.5,
              background: accentGrad,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>FLAPPY BIRD</Typography>
            <Typography sx={{ color: '#6b7280', fontSize: '0.8rem', mb: 3, textAlign: 'center', px: 4 }}>
              Tap the screen or press Space to flap through the pipes!
            </Typography>
            <Box sx={{
              display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', justifyContent: 'center',
              p: '8px 16px', borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              pointerEvents: 'auto',
            }}>
              {['Space / ↑', 'Tap Screen'].map(k => (
                <Typography key={k} sx={{ color: accentColor, fontFamily: 'monospace', fontWeight: 900, fontSize: '0.75rem',
                  bgcolor: 'rgba(6,214,160,0.1)', px: 1, py: 0.2, borderRadius: '6px',
                  border: '1px solid rgba(6,214,160,0.2)' }}>{k}</Typography>
              ))}
            </Box>
            <Button onClick={start} variant="contained" sx={{
              px: 5, py: 1.1, fontWeight: 900, fontSize: '0.95rem', borderRadius: '14px',
              background: accentGrad, pointerEvents: 'auto',
              boxShadow: '0 4px 24px #06D6A040',
              '&:hover': { boxShadow: '0 6px 32px #06D6A060' },
            }}>
              🐦 Fly!
            </Button>
          </Box>
        )}

        {/* Dead overlay */}
        {gameStatus === 'dead' && (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
            background: 'rgba(8,12,18,0.93)', backdropFilter: 'blur(10px)',
          }}>
            <Typography sx={{ fontSize: '3rem', mb: 1 }}>💀</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color: '#EF476F', mb: 1 }}>
              You Hit a Pipe!
            </Typography>
            {score >= bestScore && score > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1,
                bgcolor: 'rgba(255,209,102,0.1)', px: 1.5, py: 0.4, borderRadius: '10px',
                border: '1px solid rgba(255,209,102,0.25)' }}>
                <Typography sx={{ fontSize: '0.9rem' }}>🏆</Typography>
                <Typography sx={{ color: '#FFD166', fontWeight: 900, fontSize: '0.78rem' }}>New Personal Best!</Typography>
              </Box>
            )}
            <Typography sx={{ color: '#484f58', fontSize: '0.72rem', mb: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Score</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '2.8rem', color: '#06D6A0', fontFamily: 'monospace', mb: 3, lineHeight: 1 }}>
              {score}
            </Typography>
            <Button onClick={start} variant="contained" sx={{
              px: 5, py: 1.1, fontWeight: 900, fontSize: '0.95rem', borderRadius: '14px',
              background: accentGrad,
              boxShadow: '0 4px 24px #06D6A040',
              '&:hover': { boxShadow: '0 6px 32px #06D6A060' },
            }}>
              🐦 Try Again
            </Button>
          </Box>
        )}
      </Box>

      {/* Mobile flap button — big easy target below canvas */}
      {gameStatus === 'playing' && (
        <Box
          onPointerDown={(e) => { e.preventDefault(); flap(); }}
          sx={{
            width: W, mt: 1.5, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '14px', fontSize: '1rem', fontWeight: 800,
            color: accentColor,
            background: 'rgba(6,214,160,0.06)',
            border: '1px solid rgba(6,214,160,0.22)',
            cursor: 'pointer', userSelect: 'none',
            transition: 'all 0.1s',
            '&:active': { background: 'rgba(6,214,160,0.18)', transform: 'scale(0.97)' },
          }}
        >
          🐦 TAP TO FLAP
        </Box>
      )}
    </Box>
  );
}
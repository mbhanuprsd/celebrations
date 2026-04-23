// src/games/racing/RacingGame.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { saveSoloScore, getLocalSoloBest } from '../../firebase/services';

const W = 360;
const H = 600;
const LANE_COUNT = 3;
const LANE_WIDTH = W / LANE_COUNT;
const CAR_W = 36;
const CAR_H = 60;
const OBSTACLE_W = 36;
const OBSTACLE_H = 60;
const INITIAL_SPEED = 2;
const SPEED_INCREMENT = 0.0010;

function getLaneX(lane) {
  return lane * LANE_WIDTH + LANE_WIDTH / 2 - CAR_W / 2;
}

function drawRoad(ctx, offset) {
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Road
  ctx.fillStyle = '#2d2d44';
  ctx.fillRect(0, 0, W, H);

  // Side strips
  ctx.fillStyle = '#3d3d5c';
  ctx.fillRect(0, 0, 20, H);
  ctx.fillRect(W - 20, 0, 20, H);

  // Lane dashes
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.setLineDash([40, 30]);
  for (let l = 1; l < LANE_COUNT; l++) {
    ctx.beginPath();
    ctx.moveTo(l * LANE_WIDTH, 0);
    ctx.lineTo(l * LANE_WIDTH, H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawCar(ctx, x, y, color, accent) {
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 10, CAR_W - 8, CAR_H - 16, 6);
  ctx.fill();

  // Cabin
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 16, CAR_W - 16, 22, 4);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(x, y + 12, 8, 14);
  ctx.fillRect(x + CAR_W - 8, y + 12, 8, 14);
  ctx.fillRect(x, y + CAR_H - 26, 8, 14);
  ctx.fillRect(x + CAR_W - 8, y + CAR_H - 26, 8, 14);

  // Headlights
  ctx.fillStyle = '#fffaaa';
  ctx.fillRect(x + 6, y + 8, 8, 5);
  ctx.fillRect(x + CAR_W - 14, y + 8, 8, 5);

  // Taillights
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(x + 6, y + CAR_H - 14, 8, 5);
  ctx.fillRect(x + CAR_W - 14, y + CAR_H - 14, 8, 5);
}

function drawObstacle(ctx, x, y) {
  drawCar(ctx, x, y, '#ef476f', '#b33154');
}

function drawExplosion(ctx, x, y, frame) {
  const r = frame * 4;
  const alpha = Math.max(0, 1 - frame / 15);
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(x + CAR_W / 2, y + CAR_H / 2, 0, x + CAR_W / 2, y + CAR_H / 2, r);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.3, '#ffd166');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x + CAR_W / 2, y + CAR_H / 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function RacingGame({ onExit, userId, playerName }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const animRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | dead
  const [bestScore, setBestScore] = useState(() => getLocalSoloBest(userId, 'racing'));

  const initState = useCallback(() => ({
    lane: 1,
    targetLane: 1,
    carX: getLaneX(1),
    carY: H - CAR_H - 20,
    obstacles: [],
    speed: INITIAL_SPEED,
    roadOffset: 0,
    spawnTimer: 0,
    score: 0,
    dead: false,
    explosionFrame: 0,
    explosionX: 0,
    explosionY: 0,
  }), []);

  const start = useCallback(() => {
    stateRef.current = initState();
    setScore(0);
    setGameStatus('playing');
  }, [initState]);

  // Input handling
  useEffect(() => {
    const onKey = (e) => {
      const s = stateRef.current;
      if (!s || s.dead) return;
      if (e.key === 'ArrowLeft' && s.targetLane > 0) s.targetLane--;
      if (e.key === 'ArrowRight' && s.targetLane < LANE_COUNT - 1) s.targetLane++;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSwipe = useCallback((dir) => {
    const s = stateRef.current;
    if (!s || s.dead) return;
    if (dir === 'left' && s.targetLane > 0) s.targetLane--;
    if (dir === 'right' && s.targetLane < LANE_COUNT - 1) s.targetLane++;
  }, []);

  // Touch swipe
  const touchStartX = useRef(null);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 30) handleSwipe(dx < 0 ? 'left' : 'right');
    touchStartX.current = null;
  };

  // Game loop
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      const s = stateRef.current;
      if (!s) return;

      // Move car toward target lane
      const targetX = getLaneX(s.targetLane);
      const dx = targetX - s.carX;
      s.carX += dx * 0.18;

      // Road scroll
      s.roadOffset = (s.roadOffset + s.speed) % (40 + 30);

      // Speed up over time
      s.speed += SPEED_INCREMENT;

      // Spawn obstacles
      s.spawnTimer++;
      const spawnInterval = Math.max(35, 80 - s.speed * 4);
      if (s.spawnTimer >= spawnInterval) {
        s.spawnTimer = 0;
        const usedLanes = s.obstacles.filter(o => o.y < -OBSTACLE_H + 100).map(o => o.lane);
        let lane;
        let tries = 0;
        do { lane = Math.floor(Math.random() * LANE_COUNT); tries++; }
        while (usedLanes.includes(lane) && tries < 10);
        s.obstacles.push({ lane, x: getLaneX(lane), y: -OBSTACLE_H });
      }

      // Move obstacles
      s.obstacles.forEach(o => { o.y += s.speed; });
      s.obstacles = s.obstacles.filter(o => o.y < H + 20);

      // Collision
      if (!s.dead) {
        for (const o of s.obstacles) {
          const px = s.carX, py = s.carY;
          const ox = o.x, oy = o.y;
          const margin = 6;
          if (
            px + CAR_W - margin > ox + margin &&
            px + margin < ox + OBSTACLE_W - margin &&
            py + CAR_H - margin > oy + margin &&
            py + margin < oy + OBSTACLE_H - margin
          ) {
            s.dead = true;
            s.explosionX = s.carX;
            s.explosionY = s.carY;
            s.explosionFrame = 0;
            const finalScore = Math.floor(s.score);
            setGameStatus('dead');
            // Save score
            saveSoloScore(userId, playerName, 'racing', finalScore);
            setBestScore(prev => Math.max(prev, finalScore));
            break;
          }
        }
      }

      // Score
      s.score += s.speed * 0.1;
      const rounded = Math.floor(s.score);
      setScore(rounded);

      // Draw
      drawRoad(ctx, s.roadOffset);

      // Draw obstacles
      s.obstacles.forEach(o => drawObstacle(ctx, o.x, o.y));

      // Draw player car
      if (!s.dead) {
        drawCar(ctx, s.carX, s.carY, '#4cc9f0', '#2a6f8f');
      } else {
        // Explosion
        s.explosionFrame++;
        drawExplosion(ctx, s.explosionX, s.explosionY, s.explosionFrame);
        if (s.explosionFrame > 30) return; // stop loop
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameStatus]);

  return (
    <Box sx={{
      position: 'fixed', inset: 0, bgcolor: '#080c12', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Header */}
      <Box sx={{ width: W, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: 0.5 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onExit}
          size="small"
          sx={{ color: '#8b949e', fontSize: '0.75rem', fontWeight: 700, '&:hover': { color: '#4CC9F0' } }}
        >
          Exit
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ color: '#FFD166', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'monospace' }}>
            🏁 {score.toLocaleString()}
          </Typography>
          {bestScore > 0 && (
            <Typography sx={{ color: '#484f58', fontWeight: 700, fontSize: '0.7rem', fontFamily: 'monospace' }}>
              BEST {bestScore.toLocaleString()}
            </Typography>
          )}
        </Box>
        <Box sx={{ width: 60 }} />
      </Box>

      {/* Canvas */}
      <Box sx={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />

        {/* Idle overlay */}
        {gameStatus === 'idle' && (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
            background: 'rgba(8,12,18,0.82)', backdropFilter: 'blur(4px)',
          }}>
            <Typography sx={{ fontSize: '3rem', mb: 1 }}>🏎️</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color: '#4CC9F0', mb: 0.5 }}>Endless Racing</Typography>
            <Typography sx={{ color: '#8b949e', fontSize: '0.82rem', mb: 3, textAlign: 'center', px: 3 }}>
              Dodge traffic and survive as long as you can!
            </Typography>
            <Typography sx={{ color: '#484f58', fontSize: '0.75rem', mb: 0.5 }}>⬅️ ➡️ Arrow keys or swipe to steer</Typography>
            <Button
              onClick={start}
              variant="contained"
              sx={{
                mt: 2.5, px: 4, py: 1.2, fontWeight: 900, fontSize: '1rem', borderRadius: '14px',
                background: 'linear-gradient(135deg, #4CC9F0, #7209B7)',
                boxShadow: '0 4px 24px #4CC9F040',
                '&:hover': { background: 'linear-gradient(135deg, #6dd5f5, #9314d4)' },
              }}
            >
              Start Game
            </Button>
          </Box>
        )}

        {/* Dead overlay */}
        {gameStatus === 'dead' && (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
            background: 'rgba(8,12,18,0.88)', backdropFilter: 'blur(6px)',
          }}>
            <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>💥</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#EF476F', mb: 0.5 }}>Crashed!</Typography>
            {score >= bestScore && score > 0 && (
              <Typography sx={{ color: '#FFD166', fontWeight: 900, fontSize: '0.8rem', mb: 0.5,
                bgcolor: 'rgba(255,209,102,0.12)', px: 1.5, py: 0.3, borderRadius: '8px',
                border: '1px solid rgba(255,209,102,0.25)' }}>
                🏆 New Personal Best!
              </Typography>
            )}
            <Typography sx={{ color: '#8b949e', fontSize: '0.85rem', mb: 0.5 }}>Score</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '2.2rem', color: '#FFD166', fontFamily: 'monospace', mb: 3 }}>
              {score.toLocaleString()}
            </Typography>
            <Button
              onClick={start}
              variant="contained"
              sx={{
                px: 4, py: 1.2, fontWeight: 900, fontSize: '1rem', borderRadius: '14px',
                background: 'linear-gradient(135deg, #4CC9F0, #7209B7)',
                boxShadow: '0 4px 24px #4CC9F040',
              }}
            >
              Play Again
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

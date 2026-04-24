// src/games/solo/TetrisGame.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { saveSoloScore, getLocalSoloBest } from '../../firebase/services';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const W = COLS * CELL;       // 280
const H = ROWS * CELL;       // 560
const PREVIEW_CELL = 22;

const COLORS = {
  I: '#4CC9F0',
  O: '#FFD166',
  T: '#c77dff',
  S: '#06D6A0',
  Z: '#EF476F',
  J: '#4361EE',
  L: '#FF9F1C',
};

const PIECES = {
  I: { shape: [[1,1,1,1]], color: 'I' },
  O: { shape: [[1,1],[1,1]], color: 'O' },
  T: { shape: [[0,1,0],[1,1,1]], color: 'T' },
  S: { shape: [[0,1,1],[1,1,0]], color: 'S' },
  Z: { shape: [[1,1,0],[0,1,1]], color: 'Z' },
  J: { shape: [[1,0,0],[1,1,1]], color: 'J' },
  L: { shape: [[0,0,1],[1,1,1]], color: 'L' },
};

const PIECE_KEYS = Object.keys(PIECES);

// Points per lines cleared (classic Tetris)
const LINE_POINTS = [0, 100, 300, 500, 800];

// Drop interval in ms per level
const DROP_INTERVAL = (level) => Math.max(80, 600 - level * 55);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  const def = PIECES[key];
  return { shape: def.shape.map(r => [...r]), color: def.color, key };
}

function rotate(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function isValid(board, shape, ox, oy) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nr = oy + r, nc = ox + c;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
        if (board[nr][nc]) return false;
      }
  return true;
}

function place(board, shape, ox, oy, color) {
  const next = board.map(r => [...r]);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) next[oy + r][ox + c] = color;
  return next;
}

function clearLines(board) {
  const kept = board.filter(row => row.some(c => !c));
  const cleared = ROWS - kept.length;
  const empty = Array.from({ length: cleared }, () => Array(COLS).fill(null));
  return { board: [...empty, ...kept], cleared };
}

function ghostY(board, shape, ox, oy) {
  let y = oy;
  while (isValid(board, shape, ox, y + 1)) y++;
  return y;
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

function drawCell(ctx, x, y, color, size = CELL, alpha = 1) {
  const pad = 1;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, 3);
  ctx.fill();
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(x + pad + 2, y + pad + 2, size - pad * 2 - 4, 5, 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBoard(ctx, board) {
  // Background
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
  }

  // Placed cells
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) drawCell(ctx, c * CELL, r * CELL, COLORS[board[r][c]] || '#888');
}

function drawPiece(ctx, shape, ox, oy, color, alpha = 1) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) drawCell(ctx, (ox + c) * CELL, (oy + r) * CELL, COLORS[color] || '#888', CELL, alpha);
}

function drawPreview(ctx, shape, color, size = PREVIEW_CELL) {
  const cols = shape[0].length, rows = shape.length;
  const offX = Math.floor((4 - cols) / 2);
  const offY = Math.floor((4 - rows) / 2);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (shape[r][c]) drawCell(ctx, (offX + c) * size, (offY + r) * size, COLORS[color] || '#888', size);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TetrisGame({ onExit, userId, playerName }) {
  const canvasRef   = useRef(null);
  const previewRef  = useRef(null);
  const gameRef     = useRef(null);   // mutable game state
  const animRef     = useRef(null);
  const dropRef     = useRef(null);

  const [score,      setScore]      = useState(0);
  const [lines,      setLines]      = useState(0);
  const [level,      setLevel]      = useState(1);
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | paused | over
  const [bestScore,  setBestScore]  = useState(() => getLocalSoloBest(userId, 'tetris'));

  // ── Init ────────────────────────────────────────────────────────────────────
  const initGame = useCallback(() => {
    const cur  = randomPiece();
    const next = randomPiece();
    return {
      board:  createBoard(),
      cur,
      next,
      ox: Math.floor((COLS - cur.shape[0].length) / 2),
      oy: 0,
      score: 0,
      lines: 0,
      level: 1,
      over:  false,
    };
  }, []);

  // ── Drop timer ──────────────────────────────────────────────────────────────
  const scheduleDropRef = useRef(null);

  const scheduleDrop = useCallback((level) => {
    if (dropRef.current) clearTimeout(dropRef.current);
    dropRef.current = setTimeout(() => {
      scheduleDropRef.current?.(level);
    }, DROP_INTERVAL(level));
  }, []);

  const dropPiece = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.over) return;

    if (isValid(g.board, g.cur.shape, g.ox, g.oy + 1)) {
      g.oy += 1;
    } else {
      // Lock
      g.board = place(g.board, g.cur.shape, g.ox, g.oy, g.cur.color);
      const { board: nb, cleared } = clearLines(g.board);
      g.board = nb;

      const pts = LINE_POINTS[cleared] * g.level;
      g.score += pts;
      g.lines += cleared;
      g.level = Math.floor(g.lines / 10) + 1;

      setScore(g.score);
      setLines(g.lines);
      setLevel(g.level);

      // Spawn next
      g.cur  = g.next;
      g.next = randomPiece();
      g.ox   = Math.floor((COLS - g.cur.shape[0].length) / 2);
      g.oy   = 0;

      if (!isValid(g.board, g.cur.shape, g.ox, g.oy)) {
        g.over = true;
        const finalScore = g.score;
        setGameStatus('over');
        saveSoloScore(userId, playerName, 'tetris', finalScore);
        setBestScore(prev => Math.max(prev, finalScore));
        return;
      }
    }

    scheduleDrop(g.level);
  }, [scheduleDrop, userId, playerName]);

  // Wire scheduleDropRef so the closure inside scheduleDrop always calls latest dropPiece
  useEffect(() => {
    scheduleDropRef.current = dropPiece;
  }, [dropPiece]);

  // ── Render loop ─────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    if (!canvas || !preview) return;

    const ctx = canvas.getContext('2d');
    drawBoard(ctx, g.board);

    // Ghost piece
    const gy = ghostY(g.board, g.cur.shape, g.ox, g.oy);
    if (gy !== g.oy) drawPiece(ctx, g.cur.shape, g.ox, gy, g.cur.color, 0.18);

    // Active piece
    drawPiece(ctx, g.cur.shape, g.ox, g.oy, g.cur.color);

    // Preview canvas
    const pctx = preview.getContext('2d');
    pctx.clearRect(0, 0, preview.width, preview.height);
    drawPreview(pctx, g.next.shape, g.next.color);

    animRef.current = requestAnimationFrame(render);
  }, []);

  // ── Start ───────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (dropRef.current) clearTimeout(dropRef.current);
    cancelAnimationFrame(animRef.current);
    const g = initGame();
    gameRef.current = g;
    setScore(0); setLines(0); setLevel(1);
    setGameStatus('playing');
    scheduleDrop(1);
    animRef.current = requestAnimationFrame(render);
  }, [initGame, scheduleDrop, render]);

  // Restart render loop when status becomes playing
  useEffect(() => {
    if (gameStatus === 'playing') {
      cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(render);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [gameStatus, render]);

  // ── Input ───────────────────────────────────────────────────────────────────
  const move = useCallback((dx) => {
    const g = gameRef.current;
    if (!g || g.over) return;
    if (isValid(g.board, g.cur.shape, g.ox + dx, g.oy)) g.ox += dx;
  }, []);

  const rotatePiece = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.over) return;
    const rotated = rotate(g.cur.shape);
    // Wall kick: try offset 0, ±1, ±2
    for (const kick of [0, -1, 1, -2, 2]) {
      if (isValid(g.board, rotated, g.ox + kick, g.oy)) {
        g.cur = { ...g.cur, shape: rotated };
        g.ox += kick;
        return;
      }
    }
  }, []);

  const hardDrop = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.over) return;
    const gy = ghostY(g.board, g.cur.shape, g.ox, g.oy);
    g.oy = gy;
    dropPiece();
  }, [dropPiece]);

  const softDrop = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.over) return;
    if (isValid(g.board, g.cur.shape, g.ox, g.oy + 1)) {
      g.oy += 1;
      g.score += 1;
      setScore(g.score);
    }
  }, []);

  // Keyboard
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const onKey = (e) => {
      if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft')  move(-1);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowDown')  softDrop();
      if (e.key === 'ArrowUp')    rotatePiece();
      if (e.key === ' ')          hardDrop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameStatus, move, rotatePiece, softDrop, hardDrop]);

  // Touch swipe
  const touchStart = useRef(null);
  const onTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.time;
    touchStart.current = null;

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) { rotatePiece(); return; }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 20) move(dx > 0 ? 1 : -1);
    } else {
      if (dy > 40) hardDrop();
    }
  };

  // Cleanup on unmount
  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    if (dropRef.current) clearTimeout(dropRef.current);
  }, []);

  const SIDEBAR_W = 88;
  const TOTAL_W = W + SIDEBAR_W;

  return (
    <Box sx={{
      position: 'fixed', inset: 0, bgcolor: '#080c12', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Header */}
      <Box sx={{ width: TOTAL_W, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: 0.5 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onExit} size="small"
          sx={{ color: '#8b949e', fontSize: '0.75rem', fontWeight: 700, '&:hover': { color: '#c77dff' } }}>
          Exit
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ color: '#c77dff', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'monospace' }}>
            🟣 {score.toLocaleString()}
          </Typography>
          {bestScore > 0 && (
            <Typography sx={{ color: '#484f58', fontWeight: 700, fontSize: '0.7rem', fontFamily: 'monospace' }}>
              BEST {bestScore.toLocaleString()}
            </Typography>
          )}
        </Box>
        <Box sx={{ width: 60 }} />
      </Box>

      {/* Game area */}
      <Box sx={{ display: 'flex', gap: 0, position: 'relative' }}>
        {/* Board */}
        <Box sx={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{ borderRadius: '12px 0 0 12px', border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />

          {/* Idle overlay */}
          {gameStatus === 'idle' && (
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', borderRadius: '12px 0 0 12px',
              background: 'rgba(8,12,18,0.88)', backdropFilter: 'blur(6px)',
            }}>
              <Typography sx={{ fontSize: '3rem', mb: 1 }}>🧩</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color: '#c77dff', mb: 0.5 }}>Tetris</Typography>
              <Typography sx={{ color: '#8b949e', fontSize: '0.78rem', mb: 0.5, textAlign: 'center', px: 3 }}>
                Clear lines before the stack reaches the top!
              </Typography>
              <Typography sx={{ color: '#484f58', fontSize: '0.7rem', mb: 0.3 }}>⬅️ ➡️ Move   ↑ Rotate</Typography>
              <Typography sx={{ color: '#484f58', fontSize: '0.7rem', mb: 0.3 }}>↓ Soft drop   Space Hard drop</Typography>
              <Typography sx={{ color: '#484f58', fontSize: '0.7rem', mb: 2.5 }}>Tap to rotate · Swipe down to drop</Typography>
              <Button onClick={start} variant="contained" sx={{
                px: 4, py: 1.2, fontWeight: 900, fontSize: '1rem', borderRadius: '14px',
                background: 'linear-gradient(135deg, #c77dff, #7209B7)',
                boxShadow: '0 4px 24px #c77dff40',
              }}>
                Start Game
              </Button>
            </Box>
          )}

          {/* Game Over overlay */}
          {gameStatus === 'over' && (
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', borderRadius: '12px 0 0 12px',
              background: 'rgba(8,12,18,0.92)', backdropFilter: 'blur(8px)',
            }}>
              <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>💀</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#EF476F', mb: 0.5 }}>Game Over</Typography>
              {score >= bestScore && score > 0 && (
                <Typography sx={{
                  color: '#FFD166', fontWeight: 900, fontSize: '0.8rem', mb: 0.5,
                  bgcolor: 'rgba(255,209,102,0.12)', px: 1.5, py: 0.3, borderRadius: '8px',
                  border: '1px solid rgba(255,209,102,0.25)',
                }}>🏆 New Personal Best!</Typography>
              )}
              <Typography sx={{ color: '#8b949e', fontSize: '0.8rem', mb: 0.25 }}>Score</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: '#FFD166', fontFamily: 'monospace', mb: 0.5 }}>
                {score.toLocaleString()}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ color: '#484f58', fontSize: '0.68rem' }}>Lines</Typography>
                  <Typography sx={{ color: '#c9d1d9', fontWeight: 900, fontSize: '1rem', fontFamily: 'monospace' }}>{lines}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ color: '#484f58', fontSize: '0.68rem' }}>Level</Typography>
                  <Typography sx={{ color: '#c9d1d9', fontWeight: 900, fontSize: '1rem', fontFamily: 'monospace' }}>{level}</Typography>
                </Box>
              </Box>
              <Button onClick={start} variant="contained" sx={{
                px: 4, py: 1.2, fontWeight: 900, fontSize: '1rem', borderRadius: '14px',
                background: 'linear-gradient(135deg, #c77dff, #7209B7)',
                boxShadow: '0 4px 24px #c77dff40',
              }}>
                Play Again
              </Button>
            </Box>
          )}
        </Box>

        {/* Sidebar */}
        <Box sx={{
          width: SIDEBAR_W, bgcolor: 'rgba(13,17,23,0.97)',
          border: '1px solid rgba(255,255,255,0.08)', borderLeft: 'none',
          borderRadius: '0 12px 12px 0', display: 'flex', flexDirection: 'column',
          alignItems: 'center', px: 1, py: 2, gap: 2,
        }}>
          {/* Next piece */}
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <Typography sx={{ color: '#484f58', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.8 }}>Next</Typography>
            <Box sx={{
              bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)', p: 0.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 4 * PREVIEW_CELL + 8, height: 4 * PREVIEW_CELL + 8, mx: 'auto',
            }}>
              <canvas ref={previewRef} width={4 * PREVIEW_CELL} height={4 * PREVIEW_CELL} style={{ display: 'block' }} />
            </Box>
          </Box>

          {/* Stats */}
          {[
            { label: 'Level', value: level, color: '#c77dff' },
            { label: 'Lines', value: lines, color: '#06D6A0' },
          ].map(s => (
            <Box key={s.label} sx={{ width: '100%', textAlign: 'center' }}>
              <Typography sx={{ color: '#484f58', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.3 }}>{s.label}</Typography>
              <Typography sx={{ color: s.color, fontWeight: 900, fontSize: '1.2rem', fontFamily: 'monospace' }}>{s.value}</Typography>
            </Box>
          ))}

          {/* Controls hint */}
          <Box sx={{ mt: 'auto', width: '100%' }}>
            {[['↑','Rotate'],['←→','Move'],['↓','Soft'],['Spc','Drop']].map(([key, label]) => (
              <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ color: '#c77dff', fontFamily: 'monospace', fontWeight: 900, fontSize: '0.6rem',
                  bgcolor: 'rgba(199,125,255,0.1)', px: 0.6, borderRadius: '4px' }}>{key}</Typography>
                <Typography sx={{ color: '#484f58', fontSize: '0.58rem' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

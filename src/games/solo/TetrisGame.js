// src/games/solo/TetrisGame.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { saveSoloScore, getLocalSoloBest } from '../../firebase/services';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS = 10;
const ROWS = 20;
const CELL = 26;
const W = COLS * CELL;       // 280
const H = ROWS * CELL;       // 560
const PREVIEW_CELL = 20;

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

  const SIDEBAR_W = 92;
  const TOTAL_W = W + SIDEBAR_W;

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, #080c12 0%, #0d0a1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Ambient glow orbs */}
      <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', top: '-80px', left: '-80px',
        background: 'radial-gradient(circle, #c77dff12, transparent 70%)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', bottom: '5%', right: '-40px',
        background: 'radial-gradient(circle, #4CC9F010, transparent 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <Box sx={{ width: TOTAL_W, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2, px: 0.5 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onExit} size="small"
          sx={{ color: '#484f58', fontSize: '0.72rem', fontWeight: 700, minWidth: 0, px: 1,
            '&:hover': { color: '#c77dff', bgcolor: 'rgba(199,125,255,0.08)' }, borderRadius: '10px' }}>
          Back
        </Button>

        {/* Score pill */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.6,
          borderRadius: '20px', background: 'rgba(199,125,255,0.08)',
          border: '1px solid rgba(199,125,255,0.2)',
        }}>
          <Typography sx={{ color: '#c77dff', fontWeight: 900, fontSize: '1rem', fontFamily: 'monospace', lineHeight: 1 }}>
            {score.toLocaleString()}
          </Typography>
          {bestScore > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Box sx={{ width: 1, height: 14, bgcolor: 'rgba(255,255,255,0.1)' }} />
              <Typography sx={{ color: '#484f58', fontWeight: 700, fontSize: '0.62rem', fontFamily: 'monospace' }}>
                BEST {bestScore.toLocaleString()}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ width: 60 }} />
      </Box>

      {/* Game area */}
      <Box sx={{ display: 'flex', gap: 0, position: 'relative',
        borderRadius: '16px', boxShadow: '0 0 60px rgba(199,125,255,0.08)',
      }}>
        {/* Board */}
        <Box sx={{ position: 'relative' }}>
          {/* Top gradient accent */}
          <Box sx={{
            position: 'absolute', top: -2, left: 0, right: 0, height: 3, zIndex: 1,
            background: 'linear-gradient(90deg, #c77dff, #7209B7, #4CC9F0)',
            borderRadius: '12px 0 0 0',
          }} />
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{ borderRadius: '12px 0 0 12px', border: '1px solid rgba(199,125,255,0.15)', display: 'block' }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />

          {/* Idle overlay */}
          {gameStatus === 'idle' && (
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', borderRadius: '12px 0 0 12px',
              background: 'rgba(8,12,18,0.90)', backdropFilter: 'blur(8px)',
            }}>
              <Box sx={{
                width: 72, height: 72, borderRadius: '20px', mb: 2,
                background: 'linear-gradient(135deg, #c77dff22, #7209B722)',
                border: '1px solid rgba(199,125,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem',
              }}>🧩</Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.7rem', color: '#c77dff', mb: 0.5,
                background: 'linear-gradient(135deg, #c77dff, #7209B7)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                TETRIS
              </Typography>
              <Typography sx={{ color: '#6b7280', fontSize: '0.75rem', mb: 2, textAlign: 'center', px: 3 }}>
                Clear lines before the stack reaches the top!
              </Typography>
              <Box sx={{ mb: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                {[['⬅️ ➡️', 'Move'], ['↑', 'Rotate'], ['↓', 'Soft drop'], ['Space', 'Hard drop']].map(([k, v]) => (
                  <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography sx={{ color: '#c77dff', fontFamily: 'monospace', fontWeight: 900, fontSize: '0.68rem',
                      bgcolor: 'rgba(199,125,255,0.1)', px: 1, py: 0.15, borderRadius: '6px',
                      border: '1px solid rgba(199,125,255,0.2)', minWidth: 52, textAlign: 'center' }}>{k}</Typography>
                    <Typography sx={{ color: '#484f58', fontSize: '0.68rem' }}>{v}</Typography>
                  </Box>
                ))}
              </Box>
              <Button onClick={start} variant="contained" sx={{
                px: 5, py: 1.1, fontWeight: 900, fontSize: '0.95rem', borderRadius: '14px',
                background: 'linear-gradient(135deg, #c77dff, #7209B7)',
                boxShadow: '0 4px 24px #c77dff40',
                '&:hover': { boxShadow: '0 6px 32px #c77dff60' },
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
              background: 'rgba(8,12,18,0.93)', backdropFilter: 'blur(10px)',
            }}>
              <Typography sx={{ fontSize: '2.8rem', mb: 1 }}>💀</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color: '#EF476F', mb: 1 }}>Stack Overflow!</Typography>
              {score >= bestScore && score > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1,
                  bgcolor: 'rgba(255,209,102,0.1)', px: 1.5, py: 0.4, borderRadius: '10px',
                  border: '1px solid rgba(255,209,102,0.25)' }}>
                  <Typography sx={{ fontSize: '0.85rem' }}>🏆</Typography>
                  <Typography sx={{ color: '#FFD166', fontWeight: 900, fontSize: '0.78rem' }}>New Personal Best!</Typography>
                </Box>
              )}
              <Typography sx={{ color: '#484f58', fontSize: '0.72rem', mb: 0.5 }}>SCORE</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '2.2rem', color: '#FFD166', fontFamily: 'monospace', mb: 1.5 }}>
                {score.toLocaleString()}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2.5, mb: 3 }}>
                {[{ label: 'Lines', value: lines, color: '#06D6A0' }, { label: 'Level', value: level, color: '#c77dff' }].map(s => (
                  <Box key={s.label} sx={{ textAlign: 'center',
                    px: 1.5, py: 0.8, borderRadius: '12px',
                    bgcolor: `${s.color}10`, border: `1px solid ${s.color}25` }}>
                    <Typography sx={{ color: '#484f58', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', mb: 0.2 }}>{s.label}</Typography>
                    <Typography sx={{ color: s.color, fontWeight: 900, fontSize: '1.1rem', fontFamily: 'monospace' }}>{s.value}</Typography>
                  </Box>
                ))}
              </Box>
              <Button onClick={start} variant="contained" sx={{
                px: 5, py: 1.1, fontWeight: 900, fontSize: '0.95rem', borderRadius: '14px',
                background: 'linear-gradient(135deg, #c77dff, #7209B7)',
                boxShadow: '0 4px 24px #c77dff40',
                '&:hover': { boxShadow: '0 6px 32px #c77dff60' },
              }}>
                Try Again
              </Button>
            </Box>
          )}
        </Box>

        {/* Sidebar */}
        <Box sx={{
          width: SIDEBAR_W,
          background: 'linear-gradient(180deg, rgba(13,10,26,0.98) 0%, rgba(8,12,18,0.98) 100%)',
          border: '1px solid rgba(199,125,255,0.12)', borderLeft: 'none',
          borderRadius: '0 12px 12px 0', display: 'flex', flexDirection: 'column',
          alignItems: 'center', px: 1.2, py: 2, gap: 0,
        }}>
          {/* Next piece */}
          <Box sx={{ width: '100%', textAlign: 'center', mb: 2 }}>
            <Typography sx={{ color: '#484f58', fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.1em', mb: 0.8 }}>NEXT</Typography>
            <Box sx={{
              bgcolor: 'rgba(199,125,255,0.04)', borderRadius: '10px',
              border: '1px solid rgba(199,125,255,0.12)', p: 0.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 4 * PREVIEW_CELL + 8, height: 4 * PREVIEW_CELL + 8, mx: 'auto',
            }}>
              <canvas ref={previewRef} width={4 * PREVIEW_CELL} height={4 * PREVIEW_CELL} style={{ display: 'block' }} />
            </Box>
          </Box>

          {/* Stats */}
          {[
            { label: 'Level', value: level, color: '#c77dff', icon: '⚡' },
            { label: 'Lines', value: lines, color: '#06D6A0', icon: '━' },
          ].map(s => (
            <Box key={s.label} sx={{
              width: '100%', textAlign: 'center', mb: 1.5,
              p: '8px 6px', borderRadius: '10px',
              bgcolor: `${s.color}08`, border: `1px solid ${s.color}18`,
            }}>
              <Typography sx={{ color: '#484f58', fontSize: '0.56rem', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.08em', mb: 0.2 }}>{s.label}</Typography>
              <Typography sx={{ color: s.color, fontWeight: 900, fontSize: '1.3rem', fontFamily: 'monospace', lineHeight: 1 }}>
                {s.value}
              </Typography>
            </Box>
          ))}

          {/* Controls hint */}
          <Box sx={{ mt: 'auto', width: '100%' }}>
            <Typography sx={{ color: '#2d3340', fontSize: '0.54rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', textAlign: 'center', mb: 0.8 }}>Controls</Typography>
            {[['↑','Rotate'],['←→','Move'],['↓','Soft'],['Spc','Drop']].map(([key, label]) => (
              <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ color: '#c77dff', fontFamily: 'monospace', fontWeight: 900, fontSize: '0.58rem',
                  bgcolor: 'rgba(199,125,255,0.1)', px: 0.6, py: 0.1, borderRadius: '4px',
                  border: '1px solid rgba(199,125,255,0.2)' }}>{key}</Typography>
                <Typography sx={{ color: '#2d3340', fontSize: '0.56rem', fontWeight: 600 }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
// src/games/snakeladder/SnakeLadderBoard.js
import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import { cellToGrid, SNAKES, LADDERS, PLAYER_COLOR_MAP } from './snakeLadderConstants';

const COLS = 10;
const CELL = 58;
const BOARD_PX = CELL * COLS;

// ─── Dark cell palette (alternating rows) ─────────────────────────────────
const DARK_CELLS = ['#0e1520', '#111a28'];
const SNAKE_HEAD_BG  = '#2d0a0a';
const SNAKE_HEAD_BDR = '#7f1d1d';
const LADDER_BASE_BG  = '#0a1f0e';
const LADDER_BASE_BDR = '#14532d';
const GOAL_BG = '#1a1400';

// ─── Convert board cell number → SVG pixel center ─────────────────────────
function cellCenter(cell) {
  const { col, row } = cellToGrid(cell);
  return {
    x: col * CELL + CELL / 2,
    y: BOARD_PX - (row * CELL + CELL / 2),
  };
}

// ─── Snake path (wavy quadratic bezier) ───────────────────────────────────
function SnakePath({ from, to, idx }) {
  const start = cellCenter(from);
  const end   = cellCenter(to);
  const sign  = idx % 2 === 0 ? 1 : -1;
  const mid   = { x: (start.x + end.x) / 2 + sign * 36, y: (start.y + end.y) / 2 - sign * 22 };

  const SNAKE_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ec4899','#06b6d4'];
  const c = SNAKE_COLORS[idx % SNAKE_COLORS.length];

  const d = `M ${start.x} ${start.y} Q ${mid.x} ${mid.y} ${end.x} ${end.y}`;
  return (
    <g>
      <path d={d} stroke={`${c}44`} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d={d} stroke={c} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.92} />
      <path d={d} stroke="rgba(255,255,255,0.18)" strokeWidth={2.5} fill="none"
        strokeLinecap="round" strokeDasharray="5 7" />
      {/* Head circle */}
      <circle cx={start.x} cy={start.y} r={10} fill={c} stroke="#fff" strokeWidth={2} />
      <text x={start.x} y={start.y + 4.5} textAnchor="middle" fontSize="11" dominantBaseline="auto">🐍</text>
      {/* Tail dot */}
      <circle cx={end.x} cy={end.y} r={5} fill={c} opacity={0.7} />
    </g>
  );
}

// ─── Ladder path ──────────────────────────────────────────────────────────
function LadderPath({ from, to, idx }) {
  const bot = cellCenter(from);
  const top = cellCenter(to);
  const LADDER_COLORS = ['#f59e0b','#10b981','#6366f1','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4'];
  const c = LADDER_COLORS[idx % LADDER_COLORS.length];

  const angle = Math.atan2(top.y - bot.y, top.x - bot.x);
  const off = 7;
  const px = Math.sin(angle) * off;
  const py = -Math.cos(angle) * off;

  const r1 = { x1: bot.x - px, y1: bot.y - py, x2: top.x - px, y2: top.y - py };
  const r2 = { x1: bot.x + px, y1: bot.y + py, x2: top.x + px, y2: top.y + py };
  const dist = Math.hypot(top.x - bot.x, top.y - bot.y);
  const n = Math.max(2, Math.floor(dist / 22));
  const rungs = Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / (n + 1);
    return {
      x1: r1.x1 + (r1.x2 - r1.x1) * t, y1: r1.y1 + (r1.y2 - r1.y1) * t,
      x2: r2.x1 + (r2.x2 - r2.x1) * t, y2: r2.y1 + (r2.y2 - r2.y1) * t,
    };
  });

  return (
    <g opacity={0.9}>
      <line {...r1} stroke={`${c}44`} strokeWidth={7} strokeLinecap="round" />
      <line {...r2} stroke={`${c}44`} strokeWidth={7} strokeLinecap="round" />
      <line {...r1} stroke={c} strokeWidth={4} strokeLinecap="round" />
      <line {...r2} stroke={c} strokeWidth={4} strokeLinecap="round" />
      {rungs.map((r, i) => <line key={i} {...r} stroke={c} strokeWidth={3} strokeLinecap="round" />)}
      <text x={bot.x} y={bot.y + 5} textAnchor="middle" fontSize="11">🪜</text>
      <circle cx={top.x} cy={top.y} r={6} fill={c} stroke="white" strokeWidth={1.5} />
    </g>
  );
}

// ─── Animated player token ─────────────────────────────────────────────────
function PlayerToken({ uid, colorId, visualPos, totalAtCell, indexAtCell, name }) {
  const color = PLAYER_COLOR_MAP[colorId];
  if (!color || visualPos < 1) return null;

  const { x, y } = cellCenter(visualPos);
  const offsetX = totalAtCell > 1 ? (indexAtCell - (totalAtCell - 1) / 2) * 14 : 0;
  const offsetY = totalAtCell > 2 ? (indexAtCell > 1 ? 9 : -9) : 0;

  return (
    <motion.g
      key={uid}
      animate={{ x: x + offsetX, y: y + offsetY }}
      initial={false}
      transition={{ type: 'spring', stiffness: 280, damping: 26, mass: 0.8 }}
    >
      {/* Glow */}
      <circle cx={0} cy={0} r={14} fill={`${color.hex}30`} />
      {/* Shadow */}
      <circle cx={1} cy={3} r={11} fill="#0005" />
      {/* Body */}
      <circle cx={0} cy={0} r={11} fill={color.hex} stroke="white" strokeWidth={2.5}
        style={{ filter: `drop-shadow(0 0 5px ${color.hex}99)` }} />
      {/* Initial */}
      <text x={0} y={4.5} textAnchor="middle" fontSize="10.5" fill="white"
        fontWeight="bold" fontFamily="sans-serif">
        {(name || '?').charAt(0).toUpperCase()}
      </text>
    </motion.g>
  );
}

// ─── Main board component ──────────────────────────────────────────────────
export function SnakeLadderBoard({ slState, room }) {
  const { positions = {}, colorMap = {}, playerOrder = [], lastMoveInfo } = slState || {};

  // localPositions drives all token rendering – animated per-step
  const [localPositions, setLocalPositions] = useState(() => ({ ...positions }));
  const animRef = useRef(null);
  const lastMoveIdRef = useRef(null);

  // Step-by-step animation triggered by lastMoveInfo.moveId change
  const runAnimation = useCallback(async (info) => {
    if (!info) return;
    const { playerId, fromPos, preEffectPos, finalPos, effectType } = info;

    // Cancel any previous animation
    if (animRef.current) {
      animRef.current.cancelled = true;
    }
    const handle = { cancelled: false };
    animRef.current = handle;

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // 1. Step one cell at a time from fromPos → preEffectPos
    const start = Math.max(0, fromPos);
    const end   = preEffectPos;
    const step  = end >= start ? 1 : -1; // normally always positive

    for (let pos = start + step; step > 0 ? pos <= end : pos >= end; pos += step) {
      if (handle.cancelled) return;
      setLocalPositions(prev => ({ ...prev, [playerId]: pos }));
      const delay = Math.abs(end - start) <= 3 ? 220 : 150;
      await sleep(delay);
    }

    // 2. If snake or ladder, pause then slide to finalPos
    if (effectType && preEffectPos !== finalPos) {
      if (handle.cancelled) return;
      await sleep(550); // let player see they landed on the head/base
      if (handle.cancelled) return;
      setLocalPositions(prev => ({ ...prev, [playerId]: finalPos }));
    }

    animRef.current = null;
  }, []);

  // Watch moveId and trigger animation
  useEffect(() => {
    if (!lastMoveInfo) return;
    if (lastMoveInfo.moveId === lastMoveIdRef.current) return;
    lastMoveIdRef.current = lastMoveInfo.moveId;
    runAnimation(lastMoveInfo);
  }, [lastMoveInfo, runAnimation]);

  // Sync localPositions when not animating (e.g. on reset or initial load)
  useEffect(() => {
    if (!animRef.current) {
      setLocalPositions({ ...positions });
    }
  }, [positions]);

  // Build cells
  const cells = useMemo(() => Array.from({ length: 100 }, (_, i) => {
    const cell = 100 - i;
    const row  = Math.floor(i / COLS);
    const col  = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
    return { cell, row, col };
  }), []);

  // Group players by visual position for stacking offsets
  const tokensByCell = useMemo(() => {
    const map = {};
    playerOrder.forEach(uid => {
      const pos = localPositions[uid] || 0;
      if (pos >= 1) {
        if (!map[pos]) map[pos] = [];
        map[pos].push(uid);
      }
    });
    return map;
  }, [playerOrder, localPositions]);

  return (
    <Box sx={{
      width: '100%', maxWidth: BOARD_PX, mx: 'auto',
      borderRadius: '16px', overflow: 'hidden',
      border: '2px solid rgba(255,255,255,0.1)',
      boxShadow: '0 12px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      <svg viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`} width="100%" style={{ display: 'block' }}>
        {/* Board bg */}
        <rect width={BOARD_PX} height={BOARD_PX} fill="#08111e" />

        {/* Cells */}
        {cells.map(({ cell, row, col }) => {
          const x = col * CELL;
          const y = row * CELL;
          const isSnakeHead  = SNAKES[cell]   !== undefined;
          const isLadderBase = LADDERS[cell]  !== undefined;
          const isGoal       = cell === 100;

          let bg  = DARK_CELLS[(row + col) % 2];
          let bdr = 'rgba(255,255,255,0.06)';
          if (isSnakeHead)  { bg = SNAKE_HEAD_BG;  bdr = SNAKE_HEAD_BDR; }
          if (isLadderBase) { bg = LADDER_BASE_BG; bdr = LADDER_BASE_BDR; }
          if (isGoal)       { bg = GOAL_BG; }

          // Number color
          let numColor = 'rgba(180,210,255,0.55)';
          if (isSnakeHead)  numColor = '#fca5a5';
          if (isLadderBase) numColor = '#86efac';
          if (isGoal)       numColor = '#fcd34d';

          return (
            <g key={cell}>
              <rect x={x} y={y} width={CELL} height={CELL} fill={bg} stroke={bdr} strokeWidth={0.8} />
              {/* Soft inner glow for special cells */}
              {(isSnakeHead || isLadderBase) && (
                <rect x={x+1} y={y+1} width={CELL-2} height={CELL-2}
                  fill="none" stroke={isSnakeHead ? '#ef444422' : '#22c55e22'} strokeWidth={2} rx={2} />
              )}
              {/* Number — top-left corner */}
              <text x={x + 5} y={y + 13} fontSize="9.5" fill={numColor} fontWeight="700"
                fontFamily="'Roboto Mono', monospace">
                {cell}
              </text>
              {/* Goal star */}
              {isGoal && (
                <>
                  <rect x={x} y={y} width={CELL} height={CELL} fill="#ffd70018" />
                  <text x={x + CELL/2} y={y + CELL/2 + 9} textAnchor="middle" fontSize="26">🏆</text>
                </>
              )}
            </g>
          );
        })}

        {/* Ladders (below snakes) */}
        {Object.entries(LADDERS).map(([from, to], i) => (
          <LadderPath key={`l-${from}`} from={+from} to={+to} idx={i} />
        ))}

        {/* Snakes (above ladders) */}
        {Object.entries(SNAKES).map(([from, to], i) => (
          <SnakePath key={`s-${from}`} from={+from} to={+to} idx={i} />
        ))}

        {/* Player tokens */}
        {Object.entries(tokensByCell).map(([cell, uids]) =>
          uids.map((uid, idx) => (
            <PlayerToken
              key={uid}
              uid={uid}
              colorId={colorMap[uid]}
              visualPos={localPositions[uid] || 0}
              totalAtCell={uids.length}
              indexAtCell={idx}
              name={room?.players?.[uid]?.name || uid}
            />
          ))
        )}
      </svg>
    </Box>
  );
}

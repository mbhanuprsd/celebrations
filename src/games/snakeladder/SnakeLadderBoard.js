// src/games/snakeladder/SnakeLadderBoard.js
import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { cellToGrid, SNAKES, LADDERS, PLAYER_COLOR_MAP } from './snakeLadderConstants';

const BOARD_CELLS = 100;
const COLS = 10;
const CELL = 58; // px per cell
const BOARD_PX = CELL * COLS;

// Pastel cell colors for checkerboard feel
const CELL_COLORS = [
  '#FFF9F0', '#F0F9FF', '#F0FFF4', '#FFF0F9',
  '#F9F0FF', '#FFFFF0', '#F0F5FF', '#FFF5F0',
  '#F0FFFF', '#FFF0F0',
];

function cellCenter(cell) {
  const { col, row } = cellToGrid(cell);
  return {
    x: col * CELL + CELL / 2,
    y: BOARD_PX - (row * CELL + CELL / 2),
  };
}

// Draw a curved snake path between two cells
function SnakePath({ from, to, idx }) {
  const start = cellCenter(from);
  const end = cellCenter(to);
  const mx = (start.x + end.x) / 2 + (idx % 2 === 0 ? 30 : -30);
  const my = (start.y + end.y) / 2 + (idx % 2 === 0 ? -20 : 20);
  const d = `M ${start.x} ${start.y} Q ${mx} ${my} ${end.x} ${end.y}`;
  const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#06B6D4'];
  const color = colors[idx % colors.length];
  return (
    <g>
      {/* Shadow */}
      <path d={d} stroke="#0008" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.2} />
      {/* Main snake body */}
      <path d={d} stroke={color} strokeWidth={9} fill="none" strokeLinecap="round"
        strokeDasharray="0" opacity={0.9} />
      <path d={d} stroke="white" strokeWidth={3} fill="none" strokeLinecap="round"
        strokeDasharray="6 8" opacity={0.6} />
      {/* Head */}
      <circle cx={start.x} cy={start.y} r={9} fill={color} stroke="white" strokeWidth={2} />
      <text x={start.x} y={start.y + 4} textAnchor="middle" fontSize="10" fill="white">🐍</text>
      {/* Tail */}
      <circle cx={end.x} cy={end.y} r={5} fill={color} opacity={0.7} />
    </g>
  );
}

// Draw a ladder between two cells
function LadderPath({ from, to, idx }) {
  const bot = cellCenter(from);
  const top = cellCenter(to);
  const colors = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4'];
  const color = colors[idx % colors.length];

  // Two rails
  const offset = 7;
  const angle = Math.atan2(top.y - bot.y, top.x - bot.x);
  const perpX = Math.sin(angle) * offset;
  const perpY = -Math.cos(angle) * offset;

  const r1 = { x1: bot.x - perpX, y1: bot.y - perpY, x2: top.x - perpX, y2: top.y - perpY };
  const r2 = { x1: bot.x + perpX, y1: bot.y + perpY, x2: top.x + perpX, y2: top.y + perpY };

  // Rungs
  const dist = Math.sqrt((top.x - bot.x) ** 2 + (top.y - bot.y) ** 2);
  const rungCount = Math.max(2, Math.floor(dist / 24));
  const rungs = Array.from({ length: rungCount }, (_, i) => {
    const t = (i + 1) / (rungCount + 1);
    return {
      x1: r1.x1 + (r1.x2 - r1.x1) * t,
      y1: r1.y1 + (r1.y2 - r1.y1) * t,
      x2: r2.x1 + (r2.x2 - r2.x1) * t,
      y2: r2.y1 + (r2.y2 - r2.y1) * t,
    };
  });

  return (
    <g opacity={0.85}>
      {/* Shadow */}
      <line {...r1} stroke="#0004" strokeWidth={5} strokeLinecap="round" />
      <line {...r2} stroke="#0004" strokeWidth={5} strokeLinecap="round" />
      {/* Rails */}
      <line {...r1} stroke={color} strokeWidth={4} strokeLinecap="round" />
      <line {...r2} stroke={color} strokeWidth={4} strokeLinecap="round" />
      {/* Rungs */}
      {rungs.map((rung, i) => (
        <line key={i} {...rung} stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      ))}
      {/* Base & top markers */}
      <text x={bot.x} y={bot.y + 4} textAnchor="middle" fontSize="11">🪜</text>
      <circle cx={top.x} cy={top.y} r={6} fill={color} stroke="white" strokeWidth={1.5} opacity={0.9} />
    </g>
  );
}

// Player tokens on the board
function PlayerTokens({ positions, colorMap, room }) {
  // Group players by position
  const byCell = useMemo(() => {
    const map = {};
    Object.entries(positions || {}).forEach(([uid, pos]) => {
      if (pos > 0) {
        if (!map[pos]) map[pos] = [];
        map[pos].push(uid);
      }
    });
    return map;
  }, [positions]);

  return (
    <>
      {Object.entries(byCell).map(([cell, uids]) =>
        uids.map((uid, i) => {
          const colorId = colorMap?.[uid];
          const color = PLAYER_COLOR_MAP[colorId];
          if (!color) return null;
          const { x, y } = cellCenter(Number(cell));
          const total = uids.length;
          const offsetX = total > 1 ? (i - (total - 1) / 2) * 13 : 0;
          const offsetY = total > 2 ? (i > 1 ? 8 : -8) : 0;
          const playerName = room?.players?.[uid]?.name || uid;
          return (
            <motion.g key={uid}
              initial={{ scale: 0, y: -20 }}
              animate={{ x: x + offsetX, y: y + offsetY, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
              {/* Shadow */}
              <circle cx={0} cy={3} r={11} fill="#0004" />
              {/* Token */}
              <circle cx={0} cy={0} r={11} fill={color.hex} stroke="white" strokeWidth={2.5} />
              <text x={0} y={4} textAnchor="middle" fontSize="11" fill="white" fontWeight="bold">
                {playerName.charAt(0).toUpperCase()}
              </text>
            </motion.g>
          );
        })
      )}
    </>
  );
}

export function SnakeLadderBoard({ slState, room, myUserId }) {
  if (!slState) return null;
  const { positions = {}, colorMap = {} } = slState;

  // Build cells array (100 → 1 from top-left visually)
  const cells = useMemo(() => {
    return Array.from({ length: BOARD_CELLS }, (_, i) => {
      const cell = BOARD_CELLS - i; // cell 100 at top-left going to 1 at bottom-right
      const row = Math.floor(i / COLS);
      const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
      return { cell, row, col };
    });
  }, []);

  const snakeEntries = Object.entries(SNAKES);
  const ladderEntries = Object.entries(LADDERS);

  return (
    <Box sx={{
      position: 'relative',
      width: '100%',
      maxWidth: BOARD_PX,
      mx: 'auto',
      borderRadius: 3,
      overflow: 'hidden',
      border: '3px solid rgba(255,255,255,0.15)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    }}>
      <svg
        viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
        width="100%"
        style={{ display: 'block' }}
      >
        {/* Board background */}
        <rect width={BOARD_PX} height={BOARD_PX} fill="#1a2435" />

        {/* Cells */}
        {cells.map(({ cell, row, col }) => {
          const x = col * CELL;
          const y = row * CELL;
          const isSnakeHead = SNAKES[cell] !== undefined;
          const isLadderBase = LADDERS[cell] !== undefined;
          const isLadderTop = Object.values(LADDERS).includes(cell);
          const isSnakeTail = Object.values(SNAKES).includes(cell);
          const bgColor = isSnakeHead ? '#FF6B6B22'
            : isLadderBase ? '#4ADE8022'
            : CELL_COLORS[(row * COLS + col) % CELL_COLORS.length];

          return (
            <g key={cell}>
              <rect x={x} y={y} width={CELL} height={CELL}
                fill={bgColor}
                stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
              {/* Cell number */}
              <text
                x={x + CELL / 2} y={y + 14}
                textAnchor="middle" fontSize="9"
                fill={isSnakeHead ? '#FF6B6B' : isLadderBase ? '#4ADE80' : 'rgba(255,255,255,0.4)'}
                fontWeight={isSnakeHead || isLadderBase ? 'bold' : 'normal'}>
                {cell}
              </text>
              {/* Special cell icons */}
              {isSnakeHead && (
                <text x={x + CELL - 10} y={y + CELL - 6} fontSize="13" opacity={0.5}>🐍</text>
              )}
              {isLadderBase && (
                <text x={x + CELL - 10} y={y + CELL - 6} fontSize="13" opacity={0.5}>🪜</text>
              )}
              {cell === 100 && (
                <>
                  <rect x={x} y={y} width={CELL} height={CELL} fill="#FFD70030" />
                  <text x={x + CELL / 2} y={y + CELL / 2 + 6} textAnchor="middle" fontSize="22">🏆</text>
                </>
              )}
            </g>
          );
        })}

        {/* Ladders (drawn below snakes) */}
        {ladderEntries.map(([from, to], i) => (
          <LadderPath key={`ladder-${from}`} from={Number(from)} to={Number(to)} idx={i} />
        ))}

        {/* Snakes (drawn above ladders) */}
        {snakeEntries.map(([from, to], i) => (
          <SnakePath key={`snake-${from}`} from={Number(from)} to={Number(to)} idx={i} />
        ))}

        {/* Player tokens */}
        <PlayerTokens positions={positions} colorMap={colorMap} room={room} />
      </svg>
    </Box>
  );
}

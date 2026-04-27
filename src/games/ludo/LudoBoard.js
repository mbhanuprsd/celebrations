// src/games/ludo/LudoBoard.js — Ludo King style SVG board, fully detailed
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CELL_SIZE, BOARD_SIZE, LUDO_COLORS, COLOR_ORDER,
  HOME_STRETCH_CELLS, SAFE_CELLS, MAIN_PATH,
  getPieceCoord, HOME_BASE_COORDS,
} from './ludoConstants';
import { getMovablePieceIds } from './ludoFirebaseService';

const S = CELL_SIZE; // 40px

// ─── Precomputed cell classification ──────────────────────────────────────
const STRETCH_MAP = {};
for (const [color, cells] of Object.entries(HOME_STRETCH_CELLS)) {
  for (const [r, c] of cells) STRETCH_MAP[`${r},${c}`] = color;
}

const START_INDICES = { 0: 'red', 13: 'blue', 26: 'green', 39: 'yellow' };
const START_MAP = {};
for (const [idx, color] of Object.entries(START_INDICES)) {
  const pt = MAIN_PATH[+idx];
  const r = Math.round(pt.y / S - 0.5);
  const c = Math.round(pt.x / S - 0.5);
  START_MAP[`${r},${c}`] = color;
}

const SAFE_MAP = new Set();
SAFE_CELLS.forEach(idx => {
  if (START_INDICES[idx]) return;
  const pt = MAIN_PATH[idx];
  const r = Math.round(pt.y / S - 0.5);
  const c = Math.round(pt.x / S - 0.5);
  SAFE_MAP.add(`${r},${c}`);
});

function inHomeZone(row, col) {
  return (
    (row < 6 && col < 6) || (row < 6 && col > 8) ||
    (row > 8 && col > 8) || (row > 8 && col < 6)
  );
}
function onCross(row, col) {
  return (row >= 6 && row <= 8) || (col >= 6 && col <= 8);
}

// ─── Path cell colours ────────────────────────────────────────────────────
const PATH_BORDER = '#b8bccb';

function getPathFill(row, col) {
  const key = `${row},${col}`;
  if (STRETCH_MAP[key]) return LUDO_COLORS[STRETCH_MAP[key]].hex;
  if (START_MAP[key]) return LUDO_COLORS[START_MAP[key]].hex;
  if (row === 7 || col === 7) return '#d0d4e4';
  return (row === 6 || row === 8 || col === 6 || col === 8) ? '#eef0f7' : '#e8eaf2';
}

// ─── Board base ───────────────────────────────────────────────────────────
function BoardBase() {
  return (
    <>
      <rect x={0} y={0} width={BOARD_SIZE} height={BOARD_SIZE} fill="#f5f0e6" />
      <rect x={0} y={0} width={BOARD_SIZE} height={BOARD_SIZE} fill="none" stroke="#1a0f06" strokeWidth={3} />
    </>
  );
}

// ─── Cross path cells ─────────────────────────────────────────────────────
function CrossPath() {
  const cells = [];
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      if (inHomeZone(row, col)) continue;
      if (row === 7 && col >= 6 && col <= 8) continue; // center 3 cells of center row — handled in CenterHome
      if (col === 7 && row >= 6 && row <= 8) continue; // center 3 cells of center col
      if (!onCross(row, col)) continue;

      const x = col * S, y = row * S;
      const key = `${row},${col}`;
      const fill = getPathFill(row, col);
      const isStretch = !!STRETCH_MAP[key];
      const isStart = !!START_MAP[key];
      const isSafe = SAFE_MAP.has(key);
      const color = STRETCH_MAP[key] || START_MAP[key];

      cells.push(
        <g key={key}>
          <rect x={x} y={y} width={S} height={S} fill={fill} stroke={PATH_BORDER} strokeWidth={0.8} />
          {/* Stretch: inner highlight frame */}
          {isStretch && (
            <rect x={x + 2} y={y + 2} width={S - 4} height={S - 4}
              fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.45)" strokeWidth={0.8} />
          )}
          {/* Start cell: direction arrow */}
          {isStart && <StartArrow row={row} col={col} color={color} />}
          {/* Safe cell: star */}
          {isSafe && (
            <text x={x + S / 2} y={y + S / 2 + 5.5} textAnchor="middle" fontSize="17" style={{ userSelect: 'none' }}>⭐</text>
          )}
        </g>
      );
    }
  }
  return <>{cells}</>;
}

function StartArrow({ row, col, color }) {
  const x = col * S + S / 2, y = row * S + S / 2;
  const dirs = { red: [1, 0], blue: [0, 1], green: [-1, 0], yellow: [0, -1] };
  const [dx, dy] = dirs[color] || [0, 0];
  const sz = S * 0.3;
  const tip = { x: x + dx * sz, y: y + dy * sz };
  const px = -dy * sz * 0.58, py = dx * sz * 0.58;
  const b1 = { x: x - dx * sz * 0.55 + px, y: y - dy * sz * 0.55 + py };
  const b2 = { x: x - dx * sz * 0.55 - px, y: y - dy * sz * 0.55 - py };
  return (
    <polygon points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`}
      fill="rgba(255,255,255,0.82)" stroke="rgba(0,0,0,0.25)" strokeWidth={0.8} />
  );
}

// ─── Home-stretch direction arrows ────────────────────────────────────────
function StretchArrows() {
  const arrows = [];
  const dirs = { red: [1, 0], blue: [0, 1], green: [-1, 0], yellow: [0, -1] };
  for (const [color, cells] of Object.entries(HOME_STRETCH_CELLS)) {
    const [dx, dy] = dirs[color];
    for (const [r, c] of cells) {
      const x = c * S + S / 2, y = r * S + S / 2;
      const sz = S * 0.2;
      const tip = { x: x + dx * sz, y: y + dy * sz };
      const px = -dy * sz * 0.6, py = dx * sz * 0.6;
      const b1 = { x: x - dx * sz + px, y: y - dy * sz + py };
      const b2 = { x: x - dx * sz - px, y: y - dy * sz - py };
      arrows.push(
        <polygon key={`${r},${c}`}
          points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`}
          fill="rgba(255,255,255,0.65)" stroke="rgba(0,0,0,0.15)" strokeWidth={0.5} />
      );
    }
  }
  return <>{arrows}</>;
}

// ─── Home zones ───────────────────────────────────────────────────────────
const HOME_ZONE_DEFS = [
  { color: 'red', row: 0, col: 0 },
  { color: 'blue', row: 0, col: 9 },
  { color: 'green', row: 9, col: 9 },
  { color: 'yellow', row: 9, col: 0 },
];

function HomeZones({ activeColors }) {
  return (
    <>
      {HOME_ZONE_DEFS.map(({ color, row, col }) => {
        const c = LUDO_COLORS[color];
        const x = col * S, y = row * S, sz = 6 * S;
        const active = activeColors?.includes(color);
        const zoneFill = active ? c.hex : '#9aaabb';
        const innerFill = active ? c.dark : '#7a8fa0';
        const pad = S * 0.52;
        const innerSz = sz - pad * 2;
        return (
          <g key={color}>
            {/* Filled coloured square */}
            <rect x={x} y={y} width={sz} height={sz} fill={zoneFill} />
            {/* Subtle diagonal pattern on zone */}
            <rect x={x} y={y} width={sz} height={sz}
              fill="url(#diag)" opacity={0.08} />
            {/* Dark inner panel */}
            <rect x={x + pad} y={y + pad} width={innerSz} height={innerSz} fill={innerFill} />
            <rect x={x + pad} y={y + pad} width={innerSz} height={innerSz}
              fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} />
            {/* Zone outer border */}
            <rect x={x} y={y} width={sz} height={sz} fill="none" stroke="#1a0f06" strokeWidth={2} />
          </g>
        );
      })}
    </>
  );
}

// ─── Home slot circles ────────────────────────────────────────────────────
function HomeSlots({ pieces, activeColors }) {
  return (
    <>
      {COLOR_ORDER.map(color => {
        if (!activeColors?.includes(color)) return null;
        return HOME_BASE_COORDS[color].map((coord, i) => {
          const piece = pieces?.[color]?.find(p => p.id === i);
          const away = piece && piece.step !== -1;
          return (
            <g key={`slot-${color}-${i}`}>
              <circle cx={coord.x + 1.5} cy={coord.y + 3} r={S * 0.34} fill="rgba(0,0,0,0.4)" />
              <circle cx={coord.x} cy={coord.y} r={S * 0.34}
                fill={away ? 'transparent' : 'rgba(255,255,255,0.15)'}
                stroke="rgba(255,255,255,0.55)" strokeWidth={2.2} />
              {!away && (
                <circle cx={coord.x} cy={coord.y} r={S * 0.13}
                  fill="rgba(255,255,255,0.4)" />
              )}
            </g>
          );
        });
      })}
    </>
  );
}

// ─── Center home (3×3 area, 4 coloured triangles) ────────────────────────
function CenterHome() {
  const x0 = 6 * S, y0 = 6 * S, x1 = 9 * S, y1 = 9 * S;
  const cx = 7.5 * S, cy = 7.5 * S;
  const tris = [
    { color: 'red', pts: `${x0},${y0} ${x0},${y1} ${cx},${cy}` },
    { color: 'blue', pts: `${x0},${y0} ${x1},${y0} ${cx},${cy}` },
    { color: 'green', pts: `${x1},${y0} ${x1},${y1} ${cx},${cy}` },
    { color: 'yellow', pts: `${x0},${y1} ${x1},${y1} ${cx},${cy}` },
  ];
  return (
    <g>
      <rect x={x0} y={y0} width={3 * S} height={3 * S} fill="#f5f0e6" />
      {tris.map(({ color, pts }) => (
        <polygon key={color} points={pts} fill={LUDO_COLORS[color].hex}
          stroke="#f5f0e6" strokeWidth={2} />
      ))}
      {/* Diagonal separators */}
      <line x1={x0} y1={y0} x2={cx} y2={cy} stroke="#f5f0e6" strokeWidth={2} />
      <line x1={x1} y1={y0} x2={cx} y2={cy} stroke="#f5f0e6" strokeWidth={2} />
      <line x1={x1} y1={y1} x2={cx} y2={cy} stroke="#f5f0e6" strokeWidth={2} />
      <line x1={x0} y1={y1} x2={cx} y2={cy} stroke="#f5f0e6" strokeWidth={2} />
      {/* Center circle */}
      <circle cx={cx} cy={cy} r={S * 0.54} fill="white" stroke="#d8d4cc" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={S * 0.37} fill="#f5f0e6" stroke="#c0bbb3" strokeWidth={1} />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="15" style={{ userSelect: 'none' }}>🏠</text>
      {/* Border */}
      <rect x={x0} y={y0} width={3 * S} height={3 * S} fill="none" stroke="#1a0f06" strokeWidth={2} />
    </g>
  );
}

// ─── Grid lines (over path area only) ────────────────────────────────────
function GridLines() {
  const lines = [];
  for (let i = 0; i <= 15; i++) {
    // Horizontal in cross
    if (i >= 6 && i <= 9) {
      lines.push(<line key={`h${i}`} x1={0} y1={i * S} x2={BOARD_SIZE} y2={i * S}
        stroke={PATH_BORDER} strokeWidth={0.7} />);
    } else {
      lines.push(<line key={`hp${i}`} x1={6 * S} y1={i * S} x2={9 * S} y2={i * S}
        stroke={PATH_BORDER} strokeWidth={0.7} />);
    }
    // Vertical in cross
    if (i >= 6 && i <= 9) {
      lines.push(<line key={`v${i}`} x1={i * S} y1={0} x2={i * S} y2={BOARD_SIZE}
        stroke={PATH_BORDER} strokeWidth={0.7} />);
    } else {
      lines.push(<line key={`vp${i}`} x1={i * S} y1={6 * S} x2={i * S} y2={9 * S}
        stroke={PATH_BORDER} strokeWidth={0.7} />);
    }
  }
  return <>{lines}</>;
}

// ─── Piece token ──────────────────────────────────────────────────────────
function LudoPiece({ color, piece, isMovable, onClick, stackOffset = 0, lastMove }) {
  const coord = getPieceCoord(color, piece.step, piece.id);
  const c = LUDO_COLORS[color];
  const R = S * 0.3;


  return (
    <motion.g
      style={{ cursor: isMovable ? 'pointer' : 'default' }}
      onClick={isMovable ? () => onClick(piece.id) : undefined}
      initial={false}
      animate={{ x: coord.x + stackOffset * 6, y: coord.y + stackOffset * -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Pulse ring */}
      {isMovable && (
        <motion.circle r={R + 7} fill="none" stroke={c.hex} strokeWidth={2.5} opacity={0.6}
          animate={{ r: [R + 4, R + 11, R + 4], opacity: [0.55, 0.1, 0.55] }}
          transition={{ duration: 0.8, repeat: Infinity }} />
      )}
      {/* Shadow */}
      <ellipse cx={1.5} cy={R * 0.72} rx={R * 0.8} ry={R * 0.26} fill="rgba(0,0,0,0.4)" />
      {/* Base ring */}
      <circle r={R} fill={c.dark} />
      {/* Main dome */}
      <circle r={R * 0.87} fill={c.hex} />
      {/* Highlight */}
      <ellipse cx={-R * 0.27} cy={-R * 0.28} rx={R * 0.28} ry={R * 0.2}
        fill="rgba(255,255,255,0.5)" transform={`rotate(-30)`} />
      <circle cx={-R * 0.21} cy={-R * 0.22} r={R * 0.1} fill="rgba(255,255,255,0.65)" />
      {/* Center dot */}
      <circle r={R * 0.16} fill={c.dark} opacity={0.7} />
      {/* Number */}
      <text textAnchor="middle" dominantBaseline="central"
        fontSize={S * 0.21} fontWeight="900" fill="white" style={{ userSelect: 'none' }}>
        {piece.id + 1}
      </text>
      {/* Bounce arrow */}
      {isMovable && (
        <motion.polygon
          points={`0,${-R * 0.38} ${-R * 0.27},${R * 0.1} ${R * 0.27},${R * 0.1}`}
          fill={c.hex} stroke="white" strokeWidth={0.8}
          animate={{ y: [-R * 1.15, -R * 1.55, -R * 1.15] }}
          transition={{ duration: 0.65, repeat: Infinity, delay: piece.id * 0.18 }}
        />
      )}
    </motion.g>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────
export function LudoBoard({ ludoState, userId, onMovePiece }) {
  const { pieces, colorMap, activeColors, currentTurn, diceValue, diceRolled, winner } = ludoState;
  const myColor = colorMap?.[userId];
  const isMyTurn = myColor && currentTurn === myColor;

  const movablePieceIds = useMemo(() => {
    if (!isMyTurn || !diceRolled || !myColor) return new Set();
    return new Set(getMovablePieceIds(myColor, pieces[myColor], diceValue));
  }, [isMyTurn, diceRolled, myColor, pieces, diceValue]);

  const piecesByPosition = useMemo(() => {
    const map = {};
    COLOR_ORDER.forEach(color => {
      (pieces?.[color] || []).forEach(piece => {
        const coord = getPieceCoord(color, piece.step, piece.id);
        const key = `${Math.round(coord.x)}-${Math.round(coord.y)}`;
        if (!map[key]) map[key] = [];
        map[key].push({ color, piece });
      });
    });
    return map;
  }, [pieces]);

  const allPieces = useMemo(() => {
    const out = [];
    Object.values(piecesByPosition).forEach(group => {
      group.forEach(({ color, piece }, si) => {
        const movable = color === myColor && movablePieceIds.has(piece.id);
        out.push(
          <LudoPiece key={`${color}-${piece.id}`}
            color={color} piece={piece} isMovable={movable}
            onClick={onMovePiece} stackOffset={si} 
            lastMove={ludoState.lastMove && ludoState.lastMove.pieceId === piece.id ? ludoState.lastMove : null} />
        );
      });
    });
    return out;
  }, [piecesByPosition, myColor, movablePieceIds, onMovePiece, ludoState.lastMove]);

  return (
    <svg viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      style={{ width: '100%', height: '100%', display: 'block' }}>

      <defs>
        <pattern id="diag" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
        </pattern>
      </defs>

      <BoardBase />
      <HomeZones activeColors={activeColors} />
      <CrossPath />
      <StretchArrows />
      <HomeSlots pieces={pieces} activeColors={activeColors} />
      <GridLines />
      <CenterHome />
      {allPieces}

      {winner && (
        <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
          style={{ transformOrigin: `${BOARD_SIZE / 2}px ${BOARD_SIZE / 2}px` }}>
          <rect x={BOARD_SIZE / 2 - 165} y={BOARD_SIZE / 2 - 50} width={330} height={100}
            fill="rgba(10,10,20,0.94)" stroke={LUDO_COLORS[winner]?.hex} strokeWidth={3} />
          <text x={BOARD_SIZE / 2} y={BOARD_SIZE / 2 - 8} textAnchor="middle"
            fontSize="26" fontWeight="900" fill={LUDO_COLORS[winner]?.hex}>
            🏆 {(LUDO_COLORS[winner]?.name || winner).toUpperCase()} WINS!
          </text>
          <text x={BOARD_SIZE / 2} y={BOARD_SIZE / 2 + 24} textAnchor="middle" fontSize="15" fill="#c9d1d9">
            Congratulations! 🎉
          </text>
        </motion.g>
      )}
    </svg>
  );
}
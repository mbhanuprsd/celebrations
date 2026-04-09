// src/games/ludo/LudoBoard.js — Ludo King style SVG board
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CELL_SIZE, BOARD_SIZE, LUDO_COLORS, COLOR_ORDER,
  HOME_STRETCH_CELLS, SAFE_CELLS, MAIN_PATH,
  getPieceCoord, getMainPathIndex, HOME_BASE_COORDS,
} from './ludoConstants';
import { getMovablePieceIds } from './ludoFirebaseService';

const S = CELL_SIZE; // shorthand

// ─── Color helper ─────────────────────────────────────────────────────────
function getCellStretchColor(row, col) {
  for (const [color, cells] of Object.entries(HOME_STRETCH_CELLS)) {
    if (cells.some(([r, c]) => r === row && c === col)) return color;
  }
  return null;
}

function isSafeCellRC(row, col) {
  return MAIN_PATH.some((pt, idx) => {
    if (!SAFE_CELLS.has(idx)) return false;
    const c = Math.round(pt.x / S - 0.5);
    const r = Math.round(pt.y / S - 0.5);
    return r === row && c === col;
  });
}

// ─── Board background ──────────────────────────────────────────────────────
function BoardBg() {
  const cells = [];
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      const x = col * S, y = row * S;
      // Home quadrants (6x6 corners)
      const inRedHome    = row < 6 && col < 6;
      const inBlueHome   = row < 6 && col > 8;
      const inGreenHome  = row > 8 && col > 8;
      const inYellowHome = row > 8 && col < 6;
      const inHome = inRedHome || inBlueHome || inGreenHome || inYellowHome;

      // Cross path cells
      const onPath = (row >= 6 && row <= 8) || (col >= 6 && col <= 8);
      const isCenter = row === 7 && col === 7;

      if (inHome) {
        // Outer border of home zones drawn by HomeZones, just fill bg
        cells.push(<rect key={`${row}-${col}`} x={x} y={y} width={S} height={S} fill="none" />);
        continue;
      }
      if (isCenter) continue; // drawn separately

      if (onPath) {
        const sc = getCellStretchColor(row, col);
        const fill = sc ? LUDO_COLORS[sc].hex + '55' : '#1e2530';
        const safe = isSafeCellRC(row, col);
        cells.push(
          <g key={`${row}-${col}`}>
            <rect x={x} y={y} width={S} height={S} fill={fill} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            {sc && <rect x={x+2} y={y+2} width={S-4} height={S-4} rx="3" fill={LUDO_COLORS[sc].hex + '40'} />}
            {safe && !sc && (
              <text x={x+S/2} y={y+S/2+5} textAnchor="middle" fontSize="14" opacity="0.5">⭐</text>
            )}
          </g>
        );
      }
    }
  }
  return <>{cells}</>;
}

// ─── Home zones (4 big colored squares with inner white box + circles) ────
function HomeZones() {
  const zones = [
    { color: 'red',    row: 0, col: 0 },
    { color: 'blue',   row: 0, col: 9 },
    { color: 'green',  row: 9, col: 9 },
    { color: 'yellow', row: 9, col: 0 },
  ];
  return (
    <>
      {zones.map(({ color, row, col }) => {
        const x = col * S, y = row * S, size = 6 * S;
        const c = LUDO_COLORS[color];
        const innerPad = S * 0.6;
        const innerSize = size - innerPad * 2;
        return (
          <g key={color}>
            {/* Outer colored square */}
            <rect x={x} y={y} width={size} height={size} fill={c.hex} rx="4" />
            {/* White inner square */}
            <rect x={x + innerPad} y={y + innerPad} width={innerSize} height={innerSize}
              fill="#1e2530" rx="8" />
          </g>
        );
      })}
    </>
  );
}

// ─── Home base piece slots (4 circles in inner white box per color) ────────
function HomeBaseSlots({ pieces, activeColors }) {
  return (
    <>
      {COLOR_ORDER.map(color => {
        if (!activeColors?.includes(color)) return null;
        return HOME_BASE_COORDS[color].map((coord, i) => {
          const piece = pieces?.[color]?.find(p => p.id === i);
          const isHome = !piece || piece.step === -1;
          const c = LUDO_COLORS[color];
          return (
            <g key={`slot-${color}-${i}`}>
              {/* Slot circle */}
              <circle cx={coord.x} cy={coord.y} r={S * 0.36}
                fill={isHome ? c.hex + '30' : 'transparent'}
                stroke={c.hex} strokeWidth="2" opacity="0.7" />
              {/* Inner dot */}
              <circle cx={coord.x} cy={coord.y} r={S * 0.14}
                fill={c.hex} opacity="0.4" />
            </g>
          );
        });
      })}
    </>
  );
}

// ─── Center star area ──────────────────────────────────────────────────────
function CenterStar() {
  const cx = 7 * S, cy = 7 * S, size = S;
  // 4 triangles from each edge toward center
  const tris = [
    { color: 'red',    pts: `${cx},${cy} ${cx+size},${cy} ${cx+size/2},${cy+size/2}` },
    { color: 'blue',   pts: `${cx},${cy} ${cx+size},${cy} ${cx+size/2},${cy-size/2}` },
    { color: 'green',  pts: `${cx+size},${cy} ${cx+size},${cy+size} ${cx+size/2},${cy+size/2}` },
    { color: 'yellow', pts: `${cx},${cy} ${cx},${cy+size} ${cx+size/2},${cy+size/2}` },
  ];
  return (
    <>
      {tris.map(t => (
        <polygon key={t.color} points={t.pts} fill={LUDO_COLORS[t.color].hex} opacity="0.9" />
      ))}
      <circle cx={cx + size/2} cy={cy + size/2} r={size * 0.22} fill="#0d1117" opacity="0.5" />
      <text x={cx + size/2} y={cy + size/2 + 6} textAnchor="middle" fontSize="16">🏠</text>
    </>
  );
}

// ─── Grid lines ────────────────────────────────────────────────────────────
function GridLines() {
  return (
    <>
      {Array.from({ length: 16 }).map((_, i) => (
        <React.Fragment key={i}>
          <line x1={i*S} y1={0} x2={i*S} y2={BOARD_SIZE} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
          <line x1={0} y1={i*S} x2={BOARD_SIZE} y2={i*S} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        </React.Fragment>
      ))}
    </>
  );
}

// ─── Ludo King-style piece (dome/pin shape) ────────────────────────────────
function LudoPiece({ color, piece, isMovable, onClick, stackOffset = 0 }) {
  const coord = getPieceCoord(color, piece.step, piece.id);
  const ox = stackOffset * 5;
  const oy = stackOffset * -5;
  const c = LUDO_COLORS[color];

  return (
    <motion.g
      style={{ cursor: isMovable ? 'pointer' : 'default' }}
      onClick={isMovable ? () => onClick(piece.id) : undefined}
      initial={false}
      animate={{ x: coord.x + ox, y: coord.y + oy }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      {/* Pulse glow when movable */}
      {isMovable && (
        <motion.circle r={S * 0.48} fill={c.hex} opacity={0.2}
          animate={{ r: [S*0.44, S*0.54, S*0.44], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}

      {/* Shadow */}
      <ellipse cx={2} cy={S*0.28} rx={S*0.26} ry={S*0.1} fill="rgba(0,0,0,0.5)" />

      {/* Dome body — outer */}
      <circle r={S * 0.32} fill={c.dark} />
      {/* Dome body — main color */}
      <circle r={S * 0.28} fill={c.hex} />
      {/* Highlight top-left */}
      <circle cx={-S*0.1} cy={-S*0.11} r={S*0.1} fill="white" opacity="0.45" />
      {/* Center dot */}
      <circle r={S*0.08} fill={c.dark} opacity="0.7" />

      {/* Number label */}
      <text textAnchor="middle" dominantBaseline="central"
        fontSize="9" fontWeight="900" fill="white" style={{ userSelect: 'none' }}>
        {piece.id + 1}
      </text>

      {/* Arrow indicator when movable */}
      {isMovable && (
        <motion.text textAnchor="middle" y={-S*0.52} fontSize="11"
          animate={{ y: [-S*0.52, -S*0.62, -S*0.52] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: piece.id * 0.15 }}>
          ▲
        </motion.text>
      )}
    </motion.g>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
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
            onClick={onMovePiece} stackOffset={si} />
        );
      });
    });
    return out;
  }, [piecesByPosition, myColor, movablePieceIds, onMovePiece]);

  return (
    <svg viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
      style={{ width: '100%', height: '100%', display: 'block' }}>

      {/* Board base */}
      <rect x="0" y="0" width={BOARD_SIZE} height={BOARD_SIZE} rx="10" fill="#111827" />

      {/* Home zones (big colored squares) */}
      <HomeZones />

      {/* Path cells */}
      <BoardBg />

      {/* Home base slots */}
      <HomeBaseSlots pieces={pieces} activeColors={activeColors} />

      {/* Center */}
      <CenterStar />

      {/* Grid lines */}
      <GridLines />

      {/* Pieces */}
      {allPieces}

      {/* Winner banner */}
      {winner && (
        <motion.g initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
          style={{ transformOrigin: `${BOARD_SIZE/2}px ${BOARD_SIZE/2}px` }}>
          <rect x={BOARD_SIZE/2-160} y={BOARD_SIZE/2-45} width={320} height={90} rx="18"
            fill="#0d1117" stroke={LUDO_COLORS[winner]?.hex} strokeWidth="3"
            style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.7))' }} />
          <text x={BOARD_SIZE/2} y={BOARD_SIZE/2-6} textAnchor="middle"
            fontSize="24" fontWeight="900" fill={LUDO_COLORS[winner]?.hex}>
            🏆 {(LUDO_COLORS[winner]?.name || winner).toUpperCase()} WINS!
          </text>
          <text x={BOARD_SIZE/2} y={BOARD_SIZE/2+22} textAnchor="middle" fontSize="14" fill="#8b949e">
            Congratulations! 🎉
          </text>
        </motion.g>
      )}
    </svg>
  );
}

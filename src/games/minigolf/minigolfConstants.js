// src/games/minigolf/minigolfConstants.js

export const BOARD_W = 600;
export const BOARD_H = 380;
export const BALL_R  = 8;
export const HOLE_R  = 11;
export const FRICTION = 0.984;
export const MIN_SPEED = 0.12;
export const MAX_POWER = 22;
export const MAX_STROKES = 10;

export const HOLES = [
  {
    id: 'hole1', name: '1 – The Warm Up', par: 2, bg: '#1e4d20',
    start: { x: 70,  y: 190 },
    hole:  { x: 530, y: 190 },
    walls: [],
  },
  {
    id: 'hole2', name: '2 – The Blocker', par: 3, bg: '#1a3d4d',
    start: { x: 70,  y: 190 },
    hole:  { x: 530, y: 190 },
    walls: [
      { x: 260, y: 0,   w: 22, h: 240 },
      { x: 320, y: 140, w: 22, h: 240 },
    ],
  },
  {
    id: 'hole3', name: '3 – The Corner', par: 3, bg: '#2d1f50',
    start: { x: 70,  y: 310 },
    hole:  { x: 530, y:  70 },
    walls: [
      { x: 200, y: 0,   w: 22, h: 260 },
      { x: 380, y: 120, w: 22, h: 260 },
    ],
  },
  {
    id: 'hole4', name: '4 – The Island', par: 3, bg: '#4d2a1a',
    start: { x: 60,  y: 190 },
    hole:  { x: 540, y: 190 },
    walls: [
      { x: 235, y: 120, w: 130, h: 22  },
      { x: 235, y: 238, w: 130, h: 22  },
      { x: 235, y: 120, w: 22,  h: 140 },
      { x: 343, y: 120, w: 22,  h: 140 },
    ],
  },
  {
    id: 'hole5', name: '5 – The Gauntlet', par: 5, bg: '#101025',
    start: { x: 55,  y: 190 },
    hole:  { x: 545, y: 190 },
    walls: [
      { x: 140, y: 0,   w: 20, h: 220 },
      { x: 260, y: 160, w: 20, h: 220 },
      { x: 380, y: 0,   w: 20, h: 220 },
      { x: 500, y: 160, w: 20, h: 120 },
    ],
  },
];

export const BALL_COLORS = [
  '#FFFFFF', '#FACC15', '#FB923C', '#F472B6',
  '#34D399', '#60A5FA', '#A78BFA', '#F87171',
];

export function stepBall(ball, hole, walls) {
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= FRICTION;
  ball.vy *= FRICTION;

  if (ball.x - BALL_R < 0)       { ball.x = BALL_R;           ball.vx =  Math.abs(ball.vx) * 0.65; }
  if (ball.x + BALL_R > BOARD_W) { ball.x = BOARD_W - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.65; }
  if (ball.y - BALL_R < 0)       { ball.y = BALL_R;           ball.vy =  Math.abs(ball.vy) * 0.65; }
  if (ball.y + BALL_R > BOARD_H) { ball.y = BOARD_H - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.65; }

  for (const w of walls) {
    const cx = Math.max(w.x, Math.min(ball.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(ball.y, w.y + w.h));
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < BALL_R && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = cx + nx * (BALL_R + 1);
      ball.y = cy + ny * (BALL_R + 1);
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * dot * nx) * 0.65;
      ball.vy = (ball.vy - 2 * dot * ny) * 0.65;
    }
  }

  const hdx = ball.x - hole.x;
  const hdy = ball.y - hole.y;
  if (Math.hypot(hdx, hdy) < HOLE_R + BALL_R * 0.4) return 'sunk';

  if (Math.hypot(ball.vx, ball.vy) < MIN_SPEED) { ball.vx = 0; ball.vy = 0; return 'stopped'; }
  return 'moving';
}

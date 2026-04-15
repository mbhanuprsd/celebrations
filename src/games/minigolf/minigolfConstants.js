// src/games/minigolf/minigolfConstants.js

export const MINIGOLF_SETTINGS = {
  maxPlayers: 10,
  minPlayers: 2,
  holeRadius: 12,
  ballRadius: 6,
  friction: 0.98, // Velocity multiplier per frame
  maxPower: 20,
  minPower: 2,
};

export const HOLES = [
  {
    id: 'hole1',
    name: 'The Warmup',
    startPos: { x: 100, y: 500 },
    holePos: { x: 700, y: 500 },
    obstacles: [
      { x: 400, y: 400, w: 50, h: 200 },
    ],
  },
  {
    id: 'hole2',
    name: 'The ZigZag',
    startPos: { x: 100, y: 100 },
    holePos: { x: 700, y: 500 },
    obstacles: [
      { x: 300, y: 0, w: 20, h: 300 },
      { x: 500, y: 200, w: 20, h: 400 },
    ],
  },
];

export function nextIndex(current, direction, count) {
  return ((current + direction) % count + count) % count;
}

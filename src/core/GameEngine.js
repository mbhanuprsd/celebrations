// src/core/GameEngine.js
export class GameEngine {
  constructor(roomId, userId, room) {
    if (new.target === GameEngine) throw new Error('GameEngine is abstract');
    this.roomId = roomId;
    this.userId = userId;
    this.room = room;
  }
  static get name() { throw new Error('Not implemented'); }
  static get description() { throw new Error('Not implemented'); }
  static get playerRange() { return { min: 2, max: 12 }; }
  static get defaultSettings() { return {}; }
  async onStartGame(playerOrder) { throw new Error('Not implemented'); }
  onRoomUpdate(newRoom) { this.room = newRoom; }
  static getComponent() { throw new Error('Not implemented'); }
}

// ─── Game Registry ─────────────────────────────────────────────────────────
const DrawingGameEngine = () => import('../games/drawing/DrawingGameEngine');
const LudoGameEngine = () => import('../games/ludo/LudoGameEngine');

export const GameRegistry = {
  drawing: DrawingGameEngine,
  ludo: LudoGameEngine,
};

export const GAME_META = {
  drawing: {
    label: 'Draw & Guess',
    icon: '🎨',
    description: 'One player draws, others guess the word!',
    minPlayers: 2, maxPlayers: 12,
    defaultSettings: { maxPlayers: 8, rounds: 3, drawTime: 80 },
  },
  ludo: {
    label: 'Ludo',
    icon: '🎲',
    description: 'Classic race game — get all 4 pieces home first!',
    minPlayers: 2, maxPlayers: 4,
    defaultSettings: { maxPlayers: 4 },
  },
};

export const getGameEngine = (gameType) => GameRegistry[gameType] || null;

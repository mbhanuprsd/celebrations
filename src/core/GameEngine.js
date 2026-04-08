// src/core/GameEngine.js
// Abstract base class for all game types.
// To add a new game: extend this class and register in GameRegistry.

export class GameEngine {
  constructor(roomId, userId, room) {
    if (new.target === GameEngine) throw new Error('GameEngine is abstract');
    this.roomId = roomId;
    this.userId = userId;
    this.room = room;
  }

  /** Return the display name of this game */
  static get name() { throw new Error('Not implemented'); }

  /** Return a short description */
  static get description() { throw new Error('Not implemented'); }

  /** Return min/max player count */
  static get playerRange() { return { min: 2, max: 12 }; }

  /** Return default settings schema */
  static get defaultSettings() { return {}; }

  /** Called when the host clicks "Start Game" */
  async onStartGame(playerOrder) { throw new Error('Not implemented'); }

  /** Called every time room state changes */
  onRoomUpdate(newRoom) { this.room = newRoom; }

  /** Return the React component to render for this game */
  static getComponent() { throw new Error('Not implemented'); }
}

// ─── Game Registry ─────────────────────────────────────────────────────────
// Register new games here. Each entry maps a gameType string → class.

const DrawingGameEngine = () => import('../games/drawing/DrawingGameEngine');
export const GameRegistry = {
  drawing: DrawingGameEngine,
  // future: 'trivia': TriviaGameEngine,
  // future: 'wordchain': WordChainEngine,
};

export const getGameEngine = (gameType) => GameRegistry[gameType] || null;

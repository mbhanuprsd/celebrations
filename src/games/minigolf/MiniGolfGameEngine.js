// src/games/minigolf/MiniGolfGameEngine.js
import { GameEngine } from '../../core/GameEngine';
import { initMiniGolfGame } from './minigolfFirebaseService';

export class MiniGolfGameEngine extends GameEngine {
  static get name() { return 'Mini Golf'; }
  static get description() { return 'Sink the ball in the fewest strokes!'; }
  static get playerRange() { return { min: 2, max: 10 }; }
  static get defaultSettings() { return { maxPlayers: 10 }; }

  async onStartGame(playerOrder) {
    await initMiniGolfGame(this.roomId, playerOrder);
  }
}

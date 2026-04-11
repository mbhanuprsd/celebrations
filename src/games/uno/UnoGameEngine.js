// src/games/uno/UnoGameEngine.js
import { GameEngine } from '../../core/GameEngine';
import { initUnoGame } from './unoFirebaseService';

export class UnoGameEngine extends GameEngine {
  static get name() { return 'UNO'; }
  static get description() { return 'Match colors and numbers, empty your hand first!'; }
  static get playerRange() { return { min: 2, max: 10 }; }
  static get defaultSettings() { return { maxPlayers: 6 }; }

  async onStartGame(playerOrder) {
    await initUnoGame(this.roomId, playerOrder);
  }
}

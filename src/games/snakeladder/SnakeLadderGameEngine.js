// src/games/snakeladder/SnakeLadderGameEngine.js
import { GameEngine } from '../../core/GameEngine';
import { initSnakeLadderGame } from './snakeLadderFirebaseService';

export class SnakeLadderGameEngine extends GameEngine {
  static get name() { return 'Snake & Ladder'; }
  static get description() { return 'Race to 100! Watch out for snakes, climb ladders!'; }
  static get playerRange() { return { min: 2, max: 12 }; }
  static get defaultSettings() { return { maxPlayers: 4 }; }

  async onStartGame(playerOrder) {
    await initSnakeLadderGame(this.roomId, playerOrder);
  }
}

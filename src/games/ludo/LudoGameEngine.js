// src/games/ludo/LudoGameEngine.js
import { GameEngine } from '../../core/GameEngine';
import { initLudoGame } from './ludoFirebaseService';

export class LudoGameEngine extends GameEngine {
  static get name() { return 'Ludo'; }
  static get description() { return 'Race your pieces around the board!'; }
  static get playerRange() { return { min: 2, max: 4 }; }
  static get defaultSettings() { return { maxPlayers: 4 }; }

  async onStartGame(playerOrder) {
    // playerOrder is already shuffled by Lobby
    await initLudoGame(this.roomId, playerOrder);
  }
}

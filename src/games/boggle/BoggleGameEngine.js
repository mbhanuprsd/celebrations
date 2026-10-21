import { GameEngine } from '../../core/GameEngine';
import { loadBoggleDictionary, initBoggleGame } from './boggleFirebaseService';

export class BoggleGameEngine extends GameEngine {
  static get name() { return 'Boggle Party'; }
  static get description() { return 'Race to find words in a 4×4 letter grid!'; }
  static get playerRange() { return { min: 2, max: 12 }; }
  static get defaultSettings() { return { maxPlayers: 8, minWordLength: 3, roundDuration: 120 }; }

  async onStartGame(playerOrder) {
    await loadBoggleDictionary();
    await initBoggleGame(
      this.roomId,
      playerOrder,
      this.room.settings?.minWordLength || 3,
      this.room.settings?.roundDuration || 120
    );
  }
}

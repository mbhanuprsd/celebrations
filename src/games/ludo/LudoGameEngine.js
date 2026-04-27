// src/games/ludo/LudoGameEngine.js
import { GameEngine } from '../../core/GameEngine';
import { initLudoGame } from './ludoFirebaseService';
import { safeUpdateDoc } from '../../firebase/services';
import { doc } from 'firebase/firestore';
import { db } from '../../firebase';

export class LudoGameEngine extends GameEngine {
  static get name() { return 'Ludo'; }
  static get description() { return 'Race your pieces around the board!'; }
  static get playerRange() { return { min: 2, max: 4 }; }
  static get defaultSettings() { return { maxPlayers: 4 }; }

  async onStartGame(playerOrder) {
    // playerOrder is already shuffled by Lobby
    await initLudoGame(this.roomId, playerOrder);
  }

  async onRoomUpdate(room) {
    // Auto-cleanup: If the room is in 'playing' status but has no players, mark as finished
    if (room.status === 'playing' && (!room.players || Object.keys(room.players).length === 0)) {
      await safeUpdateDoc(doc(db, 'rooms', this.roomId), { status: 'finished' });
    }
  }
}

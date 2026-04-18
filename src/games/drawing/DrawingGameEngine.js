// src/games/drawing/DrawingGameEngine.js
import { GameEngine } from '../../core/GameEngine';
import {
  startGame, selectWord, advanceRound, endRound, getWordChoices,
  sendSystemMessage, recordCorrectGuess, updateDrawerScore,
  clearCanvas, clearChat
, safeUpdateDoc } from '../../firebase/services';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

export class DrawingGameEngine extends GameEngine {
  static get name() { return 'Draw & Guess'; }
  static get description() { return 'One player draws, others guess the word!'; }
  static get playerRange() { return { min: 2, max: 12 }; }
  static get defaultSettings() {
    return { maxPlayers: 8, rounds: 3, drawTime: 80 };
  }

  constructor(roomId, userId, room) {
    super(roomId, userId, room);
    this._roundTimer = null;
    this._hintTimer = null;
    this._wordChoices = null;
  }

  async onStartGame(playerOrder) {
    await clearCanvas(this.roomId);
    await clearChat(this.roomId);
    await startGame(this.roomId, playerOrder);
    // Host immediately triggers word selection for first drawer
    await safeUpdateDoc(doc(db, 'rooms', this.roomId), { status: 'selectingWord' });
    await sendSystemMessage(this.roomId, `🎨 Game started! ${this.room.players[playerOrder[0]]?.name} draws first.`);
  }

  async onWordSelected(word) {
    await clearCanvas(this.roomId);
    await selectWord(this.roomId, word);
    await sendSystemMessage(this.roomId, `⏱️ Start drawing! You have ${this.room.settings.drawTime} seconds.`);
  }

  async onCorrectGuess(guesserId, guesserName, timeRemaining, totalTime, currentGuessers) {
    const position = Object.keys(currentGuessers || {}).length + 1;
    const maxScore = 500;
    const timeBonus = Math.floor((timeRemaining / totalTime) * 300);
    const positionPenalty = (position - 1) * 50;
    const score = Math.max(50, maxScore + timeBonus - positionPenalty);

    await recordCorrectGuess(this.roomId, guesserId, score, timeBonus);

    // Give drawer a bonus per guesser
    const drawerBonus = 25;
    await updateDrawerScore(this.roomId, this.room.currentDrawer, drawerBonus);

    await sendSystemMessage(this.roomId, `✅ ${guesserName} guessed correctly! +${score} pts`);
    return score;
  }

  async onRoundTimeout(currentWord) {
    await sendSystemMessage(this.roomId, `⏰ Time's up! The word was: "${currentWord}"`);
    await this.doAdvance();
  }

  async onAllGuessed(currentWord) {
    await sendSystemMessage(this.roomId, `🎉 Everyone guessed "${currentWord}"!`);
    await this.doAdvance();
  }

  async doAdvance() {
    const { playerOrder, drawerIndex, currentRound, settings } = this.room;
    await endRound(this.roomId);
    
    // Instead of a simple setTimeout, we use a state-based approach in the UI 
    // but the engine still needs to trigger the advance.
    // To make it more robust against refreshes, we could move this to a 
    // Firebase function, but for now, we'll keep the delay and ensure 
    // the UI handles the "Round End" state.
    setTimeout(async () => {
      const continued = await advanceRound(
        this.roomId, playerOrder, drawerIndex,
        currentRound, settings.rounds
      );
      if (!continued) {
        await sendSystemMessage(this.roomId, '🏆 Game over! Check the final scores.');
      }
    }, 4000);
  }

  getWordChoices() {
    this._wordChoices = getWordChoices(3);
    return this._wordChoices;
  }
}

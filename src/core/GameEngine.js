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
const SnakeLadderGameEngine = () => import('../games/snakeladder/SnakeLadderGameEngine');
const UnoGameEngine = () => import('../games/uno/UnoGameEngine');
const MiniGolfGameEngine = () => import('../games/minigolf/MiniGolfGameEngine');
const QuizGameEngine = () => import('../games/quiz/QuizGameEngine');

export const GameRegistry = {
  drawing: DrawingGameEngine,
  ludo: LudoGameEngine,
  snakeladder: SnakeLadderGameEngine,
  uno: UnoGameEngine,
  minigolf: MiniGolfGameEngine,
  quiz: QuizGameEngine,
};

export const GAME_META = {
  drawing: {
    label: 'Draw & Guess',
    icon: '🎨',
    description: 'One player draws, others guess the word!',
    howToPlay: 'One player is chosen as the artist and given a word. They draw it on the screen while everyone else guesses in the chat. Points are awarded to the artist and the first players to guess correctly!',
    minPlayers: 2, maxPlayers: 12,
    defaultSettings: { maxPlayers: 8, rounds: 3, drawTime: 80 },
  },
  ludo: {
    label: 'Ludo',
    icon: '🎲',
    description: 'Classic race game — get all 4 pieces home first!',
    howToPlay: 'Roll the dice to move your pieces. You must roll a 6 to leave the home base. Race your pieces across the board and get them all into the center to win!',
    minPlayers: 2, maxPlayers: 4,
    defaultSettings: { maxPlayers: 4 },
  },
  snakeladder: {
    label: 'Snake & Ladder',
    icon: '🐍',
    description: 'Race to 100! Climb ladders, dodge snakes!',
    howToPlay: 'Roll the dice to move your token. Land on a ladder to skip ahead, but be careful—landing on a snake will send you sliding back down! First one to 100 wins.',
    minPlayers: 2, maxPlayers: 12,
    defaultSettings: { maxPlayers: 4 },
  },
  uno: {
    label: 'UNO',
    icon: '🃏',
    description: 'Match colors and numbers — empty your hand first!',
    howToPlay: 'Match the current card by color or number. Use Action cards like Skip, Reverse, and Draw Two to disrupt opponents. Remember to shout "UNO!" when you have one card left!',
    minPlayers: 2, maxPlayers: 10,
    defaultSettings: { maxPlayers: 6 },
  },
  minigolf: {
    label: 'Mini Golf',
    icon: '⛳',
    description: 'Sink the ball in the fewest strokes!',
    howToPlay: 'Aim your ball and adjust the power to sink it into the hole. The player who completes the course in the fewest total strokes wins!',
    minPlayers: 2, maxPlayers: 10,
    defaultSettings: { maxPlayers: 10 },
  },
  quiz: {
    label: 'Quiz',
    icon: '🧠',
    description: 'AI-generated trivia — fastest correct answer scores most!',
    howToPlay: 'Choose a topic and the AI generates unique questions. Everyone sees the same question and 4 options. Answer correctly and fast to score points — up to 1000 per question. Most points after all questions wins!',
    minPlayers: 2, maxPlayers: 12,
    defaultSettings: { maxPlayers: 12, questionCount: 8, answerTime: 20, topic: 'general' },
  },
};

export const getGameEngine = (gameType) => GameRegistry[gameType] || null;

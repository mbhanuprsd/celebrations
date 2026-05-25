// src/games/bots/botService.js
import { doc, deleteField } from 'firebase/firestore';
import { db } from '../../firebase';
import { safeUpdateDoc } from '../../firebase/services';

const BOT_NAMES = [
  'RoboMax', 'ByteBot', 'Glitch', 'Neon', 'Pixel', 'Spark',
  'Circuit', 'Nova', 'Axiom', 'Zeno', 'Turbo', 'Blip',
];

const BOT_COLORS = [
  '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#06b6d4', '#84cc16',
];

// Games that support bot players
export const BOT_SUPPORTED_GAMES = ['ludo', 'snakeladder', 'uno', 'minigolf', 'quiz'];

export function isBotSupported(gameType) {
  return BOT_SUPPORTED_GAMES.includes(gameType);
}

function nextBotNumber(existingPlayers) {
  const bots = Object.values(existingPlayers).filter(p => p.isBot);
  return bots.length + 1;
}

function pickBotName(existingPlayers) {
  const usedNames = new Set(Object.values(existingPlayers).map(p => p.name));
  const available = BOT_NAMES.filter(n => !usedNames.has(n));
  if (available.length > 0) return available[0];
  const num = nextBotNumber(existingPlayers);
  return `Bot ${num}`;
}

export async function addBotToRoom(roomId, existingPlayers) {
  const botNum  = nextBotNumber(existingPlayers);
  const botId   = `bot_${Math.random().toString(36).slice(2, 8)}`;
  const botName = pickBotName(existingPlayers);
  const color   = BOT_COLORS[(botNum - 1) % BOT_COLORS.length];

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    [`players.${botId}`]: {
      id:       botId,
      name:     botName,
      score:    0,
      isReady:  true,
      isOnline: true,
      isBot:    true,
      avatar:   { color, initials: botName.slice(0, 2).toUpperCase() },
      joinedAt: Date.now(),
    },
  });

  return botId;
}

export async function removeBotFromRoom(roomId, botId) {
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    [`players.${botId}`]: deleteField(),
  });
}
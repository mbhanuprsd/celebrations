// src/firebase/services.js
// All Firebase operations live here — keeps game logic clean and swappable.

import {
  doc, collection, setDoc, updateDoc, onSnapshot,
  serverTimestamp, deleteField, arrayUnion, getDoc, query, where, limit
} from 'firebase/firestore';
import {
  ref, set, onValue, off, push, onDisconnect, serverTimestamp as rtServerTimestamp, remove
} from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { db, rtdb, auth } from './index';
import { nanoid } from 'nanoid';

// ─── Auth ──────────────────────────────────────────────────────────────────

export const signInAnon = () => signInAnonymously(auth);

export const getCurrentUser = () => auth.currentUser;

// ─── Room Management ───────────────────────────────────────────────────────

export const createRoom = async (hostName, settings = {}, gameType = 'drawing') => {
  const roomId = nanoid(6).toUpperCase();
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  // Build settings based on game type
  const defaultSettings = gameType === 'ludo' ? { maxPlayers: 4 }
    : gameType === 'snakeladder' ? { maxPlayers: 4 }
    : { maxPlayers: 8, rounds: 3, drawTime: 80, language: 'en' };

  const roomData = {
    id: roomId,
    hostId: userId,
    status: 'waiting',
    gameType,
    settings: { ...defaultSettings, ...settings },
    players: {
      [userId]: {
        id: userId,
        name: hostName,
        score: 0,
        isReady: true,
        isOnline: true,
        avatar: generateAvatar(hostName),
        joinedAt: Date.now(),
      }
    },
    // Drawing-specific fields (ignored by Ludo)
    currentRound: 0,
    currentDrawer: null,
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'rooms', roomId), roomData);
  await setPlayerOnlineStatus(roomId, userId, true);
  return roomId;
};

export const joinRoom = async (roomId, playerName) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const roomRef = doc(db, 'rooms', roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) throw new Error('Room not found');
  const room = roomSnap.data();

  const playerCount = Object.keys(room.players || {}).length;
  if (playerCount >= room.settings.maxPlayers) throw new Error('Room is full');
  if (room.status !== 'waiting') throw new Error('Game already in progress');

  await updateDoc(roomRef, {
    [`players.${userId}`]: {
      id: userId,
      name: playerName,
      score: 0,
      isReady: true,
      isOnline: true,
      avatar: generateAvatar(playerName),
      joinedAt: Date.now(),
    }
  });

  await setPlayerOnlineStatus(roomId, userId, true);
  return room;
};

export const leaveRoom = async (roomId, userId) => {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    [`players.${userId}`]: deleteField()
  });
  await setPlayerOnlineStatus(roomId, userId, false);
};

export const setPlayerOnlineStatus = async (roomId, userId, isOnline) => {
  const presenceRef = ref(rtdb, `presence/${roomId}/${userId}`);
  if (isOnline) {
    await set(presenceRef, { online: true, lastSeen: rtServerTimestamp() });
    onDisconnect(presenceRef).set({ online: false, lastSeen: rtServerTimestamp() });
  } else {
    await set(presenceRef, { online: false, lastSeen: rtServerTimestamp() });
  }
};

// ─── Game State Management ─────────────────────────────────────────────────

export const startGame = async (roomId, playerOrder) => {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    status: 'playing',
    currentRound: 1,
    playerOrder,
    drawerIndex: 0,
    currentDrawer: playerOrder[0],
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    guessedPlayers: {},
  });
};

export const selectWord = async (roomId, word) => {
  const hint = generateHint(word);
  await updateDoc(doc(db, 'rooms', roomId), {
    currentWord: word,
    currentWordHint: hint,
    status: 'playing',
    roundStartTime: serverTimestamp(),
    guessedPlayers: {},
  });
};

export const submitGuess = async (roomId, userId, playerName, guess, currentWord) => {
  const isCorrect = guess.toLowerCase().trim() === currentWord.toLowerCase().trim();
  
  // Add message to chat
  await sendChatMessage(roomId, userId, playerName, guess, isCorrect ? 'correct' : 'chat');
  
  return isCorrect;
};

export const recordCorrectGuess = async (roomId, userId, score, timeBonus) => {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`guessedPlayers.${userId}`]: { score, timeBonus, time: Date.now() },
    [`players.${userId}.score`]: score,
  });
};

export const updateDrawerScore = async (roomId, drawerId, bonus) => {
  const roomSnap = await getDoc(doc(db, 'rooms', roomId));
  const currentScore = roomSnap.data()?.players?.[drawerId]?.score || 0;
  await updateDoc(doc(db, 'rooms', roomId), {
    [`players.${drawerId}.score`]: currentScore + bonus,
  });
};

export const advanceRound = async (roomId, playerOrder, drawerIndex, currentRound, totalRounds) => {
  const nextDrawerIndex = (drawerIndex + 1) % playerOrder.length;
  const nextRound = nextDrawerIndex === 0 ? currentRound + 1 : currentRound;
  
  if (nextRound > totalRounds) {
    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'finished',
      currentDrawer: null,
      currentWord: null,
      currentWordHint: null,
    });
    return false;
  }

  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'selectingWord',
    currentRound: nextRound,
    drawerIndex: nextDrawerIndex,
    currentDrawer: playerOrder[nextDrawerIndex],
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    guessedPlayers: {},
  });
  return true;
};

export const endRound = async (roomId) => {
  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'roundEnd',
  });
};

export const resetRoom = async (roomId, hostId) => {
  const roomSnap = await getDoc(doc(db, 'rooms', roomId));
  const room = roomSnap.data();
  const resetPlayers = {};
  Object.keys(room.players).forEach(pid => {
    resetPlayers[pid] = { ...room.players[pid], score: 0 };
  });
  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'waiting',
    currentRound: 0,
    currentDrawer: null,
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    guessedPlayers: {},
    players: resetPlayers,
  });
  await clearCanvas(roomId);
};

// ─── Real-time Canvas (RTDB for low latency) ──────────────────────────────

export const pushStroke = async (roomId, stroke) => {
  const strokesRef = ref(rtdb, `canvas/${roomId}/strokes`);
  await push(strokesRef, stroke);
};

export const clearCanvas = async (roomId) => {
  const canvasRef = ref(rtdb, `canvas/${roomId}`);
  await set(canvasRef, { cleared: Date.now() });
};

export const listenCanvas = (roomId, onStroke, onClear) => {
  const strokesRef = ref(rtdb, `canvas/${roomId}/strokes`);
  const clearedRef = ref(rtdb, `canvas/${roomId}/cleared`);

  onValue(strokesRef, (snap) => {
    const val = snap.val();
    if (val) onStroke(Object.values(val));
    else onStroke([]);
  });

  onValue(clearedRef, (snap) => {
    if (snap.val()) onClear();
  });

  return () => {
    off(strokesRef);
    off(clearedRef);
  };
};

// ─── Chat ──────────────────────────────────────────────────────────────────

export const sendChatMessage = async (roomId, userId, playerName, text, type = 'chat') => {
  const chatRef = ref(rtdb, `chat/${roomId}`);
  await push(chatRef, {
    userId,
    playerName,
    text,
    type,   // chat | correct | system | hint
    time: rtServerTimestamp(),
  });
};

export const sendSystemMessage = async (roomId, text) => {
  const chatRef = ref(rtdb, `chat/${roomId}`);
  await push(chatRef, {
    userId: 'system',
    playerName: 'System',
    text,
    type: 'system',
    time: rtServerTimestamp(),
  });
};

export const listenChat = (roomId, callback) => {
  const chatRef = ref(rtdb, `chat/${roomId}`);
  onValue(chatRef, (snap) => {
    const val = snap.val();
    if (val) {
      const messages = Object.entries(val).map(([id, msg]) => ({ id, ...msg }));
      callback(messages.slice(-100)); // keep last 100
    } else {
      callback([]);
    }
  });
  return () => off(chatRef);
};

export const clearChat = async (roomId) => {
  await remove(ref(rtdb, `chat/${roomId}`));
};

// ─── Room Listener ─────────────────────────────────────────────────────────

export const listenRoom = (roomId, callback) => {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (snap.exists()) callback(snap.data());
    else callback(null);
  });
};

// ─── Word Bank ─────────────────────────────────────────────────────────────

export const getWordChoices = (count = 3) => {
  const pool = WORD_BANK.en;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

// ─── Helpers ───────────────────────────────────────────────────────────────

export const generateHint = (word) => {
  return word.split(' ').map(w =>
    w.split('').map((ch, i) => (i === 0 ? ch : '_')).join('')
  ).join(' ');
};

export const revealHintCharacter = (word, hint) => {
  const wordArr = word.split('');
  const hintArr = hint.split('');
  const hidden = hintArr.map((c, i) => c === '_' ? i : null).filter(i => i !== null);
  if (!hidden.length) return hint;
  const revealIdx = hidden[Math.floor(Math.random() * hidden.length)];
  const newHint = hintArr.map((c, i) => i === revealIdx ? wordArr[i] : c);
  return newHint.join('');
};

const AVATAR_COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#F72585','#7209B7','#3A0CA3','#4361EE','#4CC9F0','#06D6A0'];
export const generateAvatar = (name) => {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return { color: AVATAR_COLORS[idx], initials: name.slice(0, 2).toUpperCase() };
};

// ─── Word Bank ─────────────────────────────────────────────────────────────

const WORD_BANK = {
  en: [
    // Animals
    'elephant','dolphin','penguin','giraffe','kangaroo','octopus','butterfly','crocodile',
    'hamster','peacock','flamingo','jellyfish','porcupine','cheetah','gorilla','platypus',
    // Food
    'pizza','spaghetti','hamburger','sushi','waffle','croissant','pretzel','burrito',
    'pancake','donut','cupcake','popcorn','nachos','avocado','pineapple','watermelon',
    // Objects
    'umbrella','telescope','skateboard','microscope','lighthouse','backpack','hammock',
    'compass','parachute','hourglass','trophy','binoculars','megaphone','lawnmower',
    // Places
    'library','volcano','pyramid','igloo','stadium','hospital','aquarium','factory',
    'skyscraper','submarine','treehouse','windmill','greenhouse','cathedral','observatory',
    // Actions
    'swimming','juggling','skydiving','snowboarding','surfing','climbing','dancing',
    'painting','knitting','cooking','gardening','cycling','fishing','camping','hiking',
    // Abstract
    'rainbow','thunder','eclipse','tornado','avalanche','tsunami','blizzard','mirage',
    'gravity','infinity','silence','shadow','reflection','imagination','adventure',
    // Pop culture
    'robot','spaceship','dragon','wizard','pirate','ninja','superhero','zombie','vampire',
    'astronaut','mermaid','unicorn','phoenix','dinosaur','alien','ghost',
  ]
};

// ─── Open Rooms Discovery ─────────────────────────────────────────────────

/**
 * Listen to rooms that are still waiting (not started).
 * Filters client-side to rooms where host is online via RTDB presence.
 */
export const listenOpenRooms = (callback) => {
  const q = query(
    collection(db, 'rooms'),
    where('status', '==', 'waiting'),
    limit(30)
  );

  const unsubFirestore = onSnapshot(q, async (snap) => {
    const rooms = snap.docs.map(d => d.data());
    // For each room, check RTDB presence of host
    const checks = await Promise.all(rooms.map(room => {
      return new Promise(resolve => {
        if (!room.hostId || !room.id) { resolve(null); return; }
        const presRef = ref(rtdb, `presence/${room.id}/${room.hostId}`);
        onValue(presRef, (pSnap) => {
          const presence = pSnap.val();
          if (presence?.online === true) {
            resolve(room);
          } else {
            resolve(null);
          }
        }, { onlyOnce: true });
      });
    }));
    callback(checks.filter(Boolean));
  });

  return unsubFirestore;
};

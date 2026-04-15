// src/firebase/services.js
// All Firebase operations live here — keeps game logic clean and swappable.

import {
  doc, collection, setDoc, updateDoc, onSnapshot, deleteDoc,
  serverTimestamp, deleteField, arrayUnion, getDoc, query, where, limit,
  increment, orderBy, getDocs, addDoc
} from 'firebase/firestore';
import {
  ref, set, onValue, off, push, onDisconnect, serverTimestamp as rtServerTimestamp, remove
} from 'firebase/database';
import {
  signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut
} from 'firebase/auth';
import { db, rtdb, auth } from './index';
import { nanoid } from 'nanoid';

// ─── Auth ──────────────────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithRedirect(auth, googleProvider);
export const getGoogleRedirectResult = () => getRedirectResult(auth);
export const signOutUser = () => signOut(auth);
export const getCurrentUser = () => auth.currentUser;

/**
 * Check if a display name is taken by any user OTHER than `excludeUid`.
 */
export const checkNameAvailableForUid = (name, excludeUid) => {
  return new Promise((resolve) => {
    const usersRef = ref(rtdb, 'onlineUsers');
    onValue(usersRef, (snap) => {
      const val = snap.val() || {};
      const taken = Object.values(val).some(
        u => u.uid !== excludeUid && u.name?.toLowerCase() === name.toLowerCase()
      );
      resolve(!taken);
    }, { onlyOnce: true });
  });
};

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

  // Allow rejoining if already a player in this room (resume after browser close)
  const isExistingPlayer = !!room.players?.[userId];
  if (isExistingPlayer) {
    await setPlayerOnlineStatus(roomId, userId, true);
    // Return full room data so the caller can route correctly
    const freshSnap = await getDoc(roomRef);
    return freshSnap.exists() ? freshSnap.data() : room;
  }

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

export const leaveRoom = async (roomId, userId, playerName) => {
  // Notify others before removing the player so the name is still resolvable
  if (playerName) {
    await sendSystemMessage(roomId, `${playerName} left the game`).catch(() => { });
  }
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
    [`players.${userId}.score`]: increment(score),   // ← ADD to existing score, not replace
  });
};

export const updateDrawerScore = async (roomId, drawerId, bonus) => {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`players.${drawerId}.score`]: increment(bonus), // ← atomic increment, no race condition
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

// Live stroke: the in-progress stroke from the current drawer (overwritten on each move)
export const setLiveStroke = (roomId, stroke) => {
  const liveRef = ref(rtdb, `canvas/${roomId}/live`);
  set(liveRef, stroke); // fire-and-forget, no await needed for low-latency feel
};

export const clearLiveStroke = async (roomId) => {
  await set(ref(rtdb, `canvas/${roomId}/live`), null);
};

export const clearCanvas = async (roomId) => {
  const canvasRef = ref(rtdb, `canvas/${roomId}`);
  await set(canvasRef, { cleared: Date.now() });
};

export const listenCanvas = (roomId, onStrokes, onClear, onLive) => {
  const strokesRef = ref(rtdb, `canvas/${roomId}/strokes`);
  const clearedRef = ref(rtdb, `canvas/${roomId}/cleared`);
  const liveRef    = ref(rtdb, `canvas/${roomId}/live`);

  onValue(strokesRef, (snap) => {
    const val = snap.val();
    onStrokes(val ? Object.values(val) : []);
  });

  onValue(clearedRef, (snap) => {
    if (snap.val()) onClear();
  });

  if (onLive) {
    onValue(liveRef, (snap) => {
      onLive(snap.val() || null);
    });
  }

  return () => {
    off(strokesRef);
    off(clearedRef);
    if (onLive) off(liveRef);
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

const AVATAR_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0', '#06D6A0'];
export const generateAvatar = (name) => {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return { color: AVATAR_COLORS[idx], initials: name.slice(0, 2).toUpperCase() };
};

// ─── Word Bank ─────────────────────────────────────────────────────────────

const WORD_BANK = {
  en: [
    // Animals
    'elephant', 'dolphin', 'penguin', 'giraffe', 'kangaroo', 'octopus', 'butterfly', 'crocodile',
    'hamster', 'peacock', 'flamingo', 'jellyfish', 'porcupine', 'cheetah', 'gorilla', 'platypus',
    // Food
    'pizza', 'spaghetti', 'hamburger', 'sushi', 'waffle', 'croissant', 'pretzel', 'burrito',
    'pancake', 'donut', 'cupcake', 'popcorn', 'nachos', 'avocado', 'pineapple', 'watermelon',
    // Objects
    'umbrella', 'telescope', 'skateboard', 'microscope', 'lighthouse', 'backpack', 'hammock',
    'compass', 'parachute', 'hourglass', 'trophy', 'binoculars', 'megaphone', 'lawnmower',
    // Places
    'library', 'volcano', 'pyramid', 'igloo', 'stadium', 'hospital', 'aquarium', 'factory',
    'skyscraper', 'submarine', 'treehouse', 'windmill', 'greenhouse', 'cathedral', 'observatory',
    // Actions
    'swimming', 'juggling', 'skydiving', 'snowboarding', 'surfing', 'climbing', 'dancing',
    'painting', 'knitting', 'cooking', 'gardening', 'cycling', 'fishing', 'camping', 'hiking',
    // Abstract
    'rainbow', 'thunder', 'eclipse', 'tornado', 'avalanche', 'tsunami', 'blizzard', 'mirage',
    'gravity', 'infinity', 'silence', 'shadow', 'reflection', 'imagination', 'adventure',
    // Pop culture
    'robot', 'spaceship', 'dragon', 'wizard', 'pirate', 'ninja', 'superhero', 'zombie', 'vampire',
    'astronaut', 'mermaid', 'unicorn', 'phoenix', 'dinosaur', 'alien', 'ghost',
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

// ─── Online Users (for name uniqueness + presence) ─────────────────────────

export const setUserOnline = async (uid, name) => {
  const userRef = ref(rtdb, `onlineUsers/${uid}`);
  await set(userRef, { uid, name, since: rtServerTimestamp() });
  onDisconnect(userRef).remove();
};

/**
 * Update a player's display name inside an active room (Firestore) and
 * in the onlineUsers node (RTDB).  Safe to call even when the user is
 * not currently in a room (roomId === null).
 */
export const updatePlayerNameInRoom = async (uid, roomId, newName) => {
  // Always update RTDB presence
  const userRef = ref(rtdb, `onlineUsers/${uid}`);
  await set(userRef, { uid, name: newName, since: rtServerTimestamp() });
  onDisconnect(userRef).remove();

  // Update Firestore room player entry only if inside a room
  if (roomId) {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      [`players.${uid}.name`]: newName,
      [`players.${uid}.avatar`]: generateAvatar(newName),
    });
  }
};

export const removeUserOnline = async (uid) => {
  await remove(ref(rtdb, `onlineUsers/${uid}`));
};

/** Returns true if name is free (not taken by another uid) */
export const checkNameAvailable = (name) => {
  return new Promise((resolve) => {
    const usersRef = ref(rtdb, 'onlineUsers');
    onValue(usersRef, (snap) => {
      const val = snap.val() || {};
      const taken = Object.values(val).some(
        u => u.name?.toLowerCase() === name.toLowerCase()
      );
      resolve(!taken);
    }, { onlyOnce: true });
  });
};

export const listenOnlineUsers = (callback) => {
  const usersRef = ref(rtdb, 'onlineUsers');
  const unsubscribe = onValue(usersRef, (snap) => {
    const val = snap.val() || {};
    callback(Object.values(val));
  });
  return unsubscribe;
};

// ─── Game History ──────────────────────────────────────────────────────────

/**
 * Save a completed game to the user's history.
 * gameData: { gameType, roomId, rank, totalPlayers, winner, opponents }
 */
export const saveGameHistory = async (uid, gameData) => {
  if (!uid) return;
  try {
    await addDoc(collection(db, 'users', uid, 'gameHistory'), {
      ...gameData,
      playedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('saveGameHistory failed:', e);
  }
};

/**
 * Fetch the last N completed games for a user.
 */
export const getUserGameHistory = async (uid, limitCount = 15) => {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, 'users', uid, 'gameHistory'),
      orderBy('playedAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('getUserGameHistory failed:', e);
    return [];
  }
};

// ─── Global Chat ────────────────────────────────────────────────────────────

export const sendGlobalMessage = async (userId, playerName, text) => {
  if (!userId || !text?.trim()) return;
  await addDoc(collection(db, 'globalChat'), {
    userId,
    name: playerName,
    text: text.trim(),
    timestamp: serverTimestamp(),
  });
};

export const listenGlobalChat = (callback) => {
  const q = query(
    collection(db, 'globalChat'),
    orderBy('timestamp', 'desc'),
    limit(80)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .reverse();
    callback(msgs);
  });
};

export const listenActiveGames = (callback) => {
  const q = query(
    collection(db, 'rooms'),
    where('status', '==', 'playing'),
    limit(10)
  );

  return onSnapshot(q, async (snap) => {
    const rooms = snap.docs.map(d => d.data());

    const results = await Promise.all(rooms.map(room =>
      new Promise(resolve => {
        const playerIds = Object.keys(room.players || {});

        // No players left at all — delete and hide immediately
        if (playerIds.length === 0) {
          deleteDoc(doc(db, 'rooms', room.id)).catch(() => { });
          resolve(null);
          return;
        }

        // Check RTDB presence for every player in this room
        const presenceRef = ref(rtdb, `presence/${room.id}`);
        onValue(presenceRef, (pSnap) => {
          const presence = pSnap.val() || {};
          const anyOnline = playerIds.some(uid => presence[uid]?.online === true);

          if (!anyOnline) {
            // All players offline / left — delete the room and hide it
            deleteDoc(doc(db, 'rooms', room.id)).catch(() => { });
            resolve(null);
          } else {
            resolve(room);
          }
        }, { onlyOnce: true });
      })
    ));

    callback(results.filter(Boolean));
  });
};
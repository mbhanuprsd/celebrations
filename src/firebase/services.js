// src/firebase/services.js
// All Firebase operations live here — keeps game logic clean and swappable.

import {
  doc, collection, setDoc, updateDoc, onSnapshot, deleteDoc,
  serverTimestamp, deleteField, getDoc, query, where, limit,
  increment, orderBy, getDocs, addDoc, arrayUnion
} from 'firebase/firestore';
import {
  ref, set, onValue, off, push, onDisconnect, serverTimestamp as rtServerTimestamp, remove
} from 'firebase/database';
import {
  signInWithPopup, getRedirectResult, GoogleAuthProvider, signOut, signInAnonymously
} from 'firebase/auth';
import { db, rtdb, auth } from './index';
import { nanoid } from 'nanoid';

/**
 * Safe wrapper around updateDoc — silently ignores "not-found" errors that
 * occur when a room was deleted (e.g. host left) while a game loop is still
 * running. All other errors are re-thrown as normal.
 */
export const safeUpdateDoc = async (docRef, data) => {
  try {
    await updateDoc(docRef, data);
  } catch (err) {
    if (err?.code === 'not-found' || err?.message?.includes('No document to update')) {
      return;
    }
    throw err;
  }
};

// ─── Auth ──────────────────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInAnonymouslyUser = () => signInAnonymously(auth);
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
    // FIX: return the already-fetched snapshot data — no second getDoc needed
    return room;
  }

  const playerCount = Object.keys(room.players || {}).length;
  if (playerCount >= room.settings.maxPlayers) throw new Error('Room is full');
  if (room.status !== 'waiting') throw new Error('Game already in progress');

  await safeUpdateDoc(roomRef, {
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
  
  // Check if the leaving player is the host
  const roomSnap = await getDoc(roomRef);
  const roomData = roomSnap.data();
  
  if (roomData?.hostId === userId) {
    // Host is leaving: delete the entire room to kick everyone out
    await deleteDoc(roomRef);
  } else {
    // Regular player is leaving: just remove them from the players map
    await safeUpdateDoc(roomRef, {
      [`players.${userId}`]: deleteField()
    });
  }
  
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
  await safeUpdateDoc(roomRef, {
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
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    currentWord: word,
    currentWordHint: hint,
    status: 'playing',
    roundStartTime: serverTimestamp(),
    guessedPlayers: {},
    usedWords: arrayUnion(word),   // track used words so they aren't repeated
  });
};

export const submitGuess = async (roomId, userId, playerName, guess, currentWord) => {
  const isCorrect = guess.toLowerCase().trim() === currentWord.toLowerCase().trim();

  // Add message to chat
  await sendChatMessage(roomId, userId, playerName, guess, isCorrect ? 'correct' : 'chat');

  return isCorrect;
};

export const recordCorrectGuess = async (roomId, userId, score, timeBonus) => {
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    [`guessedPlayers.${userId}`]: { score, timeBonus, time: Date.now() },
    [`players.${userId}.score`]: increment(score),   // ← ADD to existing score, not replace
  });
};

export const updateDrawerScore = async (roomId, drawerId, bonus) => {
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    [`players.${drawerId}.score`]: increment(bonus), // ← atomic increment, no race condition
  });
};

export const advanceRound = async (roomId, playerOrder, drawerIndex, currentRound, totalRounds) => {
  const nextDrawerIndex = (drawerIndex + 1) % playerOrder.length;
  const nextRound = nextDrawerIndex === 0 ? currentRound + 1 : currentRound;

  if (nextRound > totalRounds) {
    await safeUpdateDoc(doc(db, 'rooms', roomId), {
      status: 'finished',
      currentDrawer: null,
      currentWord: null,
      currentWordHint: null,
    });
    return false;
  }

  await safeUpdateDoc(doc(db, 'rooms', roomId), {
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
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
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
  await safeUpdateDoc(doc(db, 'rooms', roomId), {
    status: 'waiting',
    currentRound: 0,
    currentDrawer: null,
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    guessedPlayers: {},
    usedWords: [],              // reset word history for the new session
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

export const uploadWordBank = async () => {
  // Use the big WORD_BANK you already made
  const englishWords = WORD_BANK.en; 

  try {
    // This tells Firestore: "Go to wordBank/en and put this list there"
    await setDoc(doc(db, 'wordBank', 'en'), {
      words: englishWords
    });
    console.log("Success! All words are now in Firestore.");
  } catch (e) {
    console.error("Error uploading:", e);
  }
};

let cachedWords = [];

export const loadWordBank = async (lang = 'en') => {
  if (cachedWords.length) return; // already loaded
  try {
    const snap = await getDoc(doc(db, 'wordBank', lang));
    if (snap.exists()) cachedWords = snap.data().words || [];
  } catch (e) {
    console.warn('Word bank load failed, using fallback:', e);
    cachedWords = WORD_BANK.en; // keep the hardcoded list as fallback
  }
};

export const getWordChoices = (count = 3, usedWords = []) => {
  const pool = cachedWords.length ? cachedWords : WORD_BANK.en;
  const available = pool.filter(w => !usedWords.includes(w));
  const source = available.length >= count ? available : pool;
  return [...source].sort(() => Math.random() - 0.5).slice(0, count);
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

  // FIX: in-flight guard — if the Firestore snapshot fires again before the previous
  // batch of RTDB onValue calls has resolved, skip the new snapshot instead of
  // spawning a second batch of N listeners for the same rooms.
  let inFlight = false;

  const unsubFirestore = onSnapshot(q, async (snap) => {
    if (inFlight) return;
    inFlight = true;
    try {
      const rooms = snap.docs.map(d => d.data());
      const checks = await Promise.all(rooms.map(room => {
        return new Promise(resolve => {
          if (!room.hostId || !room.id) { resolve(null); return; }
          const presRef = ref(rtdb, `presence/${room.id}/${room.hostId}`);
          onValue(presRef, (pSnap) => {
            resolve(pSnap.val()?.online === true ? room : null);
          }, { onlyOnce: true });
        });
      }));
      callback(checks.filter(Boolean));
    } finally {
      inFlight = false;
    }
  });

  return unsubFirestore;
};

// ─── Online Users (for name uniqueness + presence) ─────────────────────────

export const setUserOnline = async (uid, name) => {
  const userRef = ref(rtdb, `onlineUsers/${uid}`);
  await set(userRef, {
    uid,
    name,
    lastSeen: rtServerTimestamp(),
  });
  onDisconnect(userRef).remove();
};

export const removeUserOnline = async (uid) => {
  await remove(ref(rtdb, `onlineUsers/${uid}`));
};

/**
 * Update a player's name both in the online list (RTDB) and in a specific room (Firestore).
 */
export const updatePlayerNameInRoom = async (userId, roomId, newName) => {
  // 1. Update in RTDB online list
  await setUserOnline(userId, newName);

  // 2. Update in Firestore room players map
  if (roomId) {
    const roomRef = doc(db, 'rooms', roomId);
    await safeUpdateDoc(roomRef, {
      [`players.${userId}.name`]: newName,
    });
  }
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
  // Anonymous users don't get game history saved (Firestore rules also block it)
  if (auth.currentUser?.isAnonymous) return;
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
  // Anonymous users cannot post to Global Chat (Firestore rules also block it)
  if (auth.currentUser?.isAnonymous) return;
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

  // FIX: in-flight guard prevents a new RTDB listener batch from spawning
  // before the previous one resolves (same pattern as listenOpenRooms).
  let inFlight = false;

  return onSnapshot(q, async (snap) => {
    if (inFlight) return;
    inFlight = true;
    try {
      const rooms = snap.docs.map(d => d.data());

      const results = await Promise.all(rooms.map(room =>
        new Promise(resolve => {
          const playerIds = Object.keys(room.players || {});

          // No players — hide from UI.
          // FIX: do NOT deleteDoc inside a snapshot callback — it triggers another
          // snapshot, can cascade, and permanently deletes rooms whose players are
          // mid-reconnect. Room cleanup should be handled by Cloud Functions / TTL rules.
          if (playerIds.length === 0) { resolve(null); return; }

          const presenceRef = ref(rtdb, `presence/${room.id}`);
          onValue(presenceRef, (pSnap) => {
            const presence  = pSnap.val() || {};
            const anyOnline = playerIds.some(uid => presence[uid]?.online === true);
            // FIX: just filter from the UI — don't delete
            resolve(anyOnline ? room : null);
          }, { onlyOnce: true });
        })
      ));

      callback(results.filter(Boolean));
    } finally {
      inFlight = false;
    }
  });
};

// ─── Solo Score Services ─────────────────────────────────────────────────────

const SOLO_SCORE_LS_KEY = (uid, gameId) => `solo_best_${gameId}_${uid}`;

/**
 * Save a solo game score.
 * - Always writes to localStorage for instant feedback.
 * - Writes to Firestore if the new score beats the stored best (any auth user).
 */
export const saveSoloScore = async (uid, playerName, gameId, score) => {
  if (!uid || !gameId || score == null) return;

  // 1. localStorage: update if better
  const lsKey = SOLO_SCORE_LS_KEY(uid, gameId);
  const localBest = parseInt(localStorage.getItem(lsKey) || '0', 10);
  if (score > localBest) localStorage.setItem(lsKey, String(score));

  // 2. Firestore: update doc if this score beats current best
  try {
    const docRef = doc(db, 'soloScores', `${uid}_${gameId}`);
    const snap = await getDoc(docRef);
    if (!snap.exists() || score > (snap.data().score || 0)) {
      await setDoc(docRef, {
        uid,
        name: playerName || 'Player',
        gameId,
        score,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('saveSoloScore Firestore failed:', e);
  }
};

/**
 * Get the local personal best from localStorage (synchronous).
 */
export const getLocalSoloBest = (uid, gameId) => {
  if (!uid || !gameId) return 0;
  return parseInt(localStorage.getItem(SOLO_SCORE_LS_KEY(uid, gameId)) || '0', 10);
};

/**
 * Listen to the top N scores for a game. Returns an unsubscribe fn.
 */
export const listenSoloLeaderboard = (gameId, callback, limitCount = 8) => {
  const q = query(
    collection(db, 'soloScores'),
    where('gameId', '==', gameId),
    orderBy('score', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map(d => d.data());
    callback(entries);
  }, (err) => {
    console.warn('listenSoloLeaderboard error:', err);
    callback([]);
  });
};

// Word bank fallback (if Firestore load fails)
const WORD_BANK = {
  en: [
    // Animals (3-8 letters)
    'cat', 'dog', 'bat', 'rat', 'ant', 'bee', 'bug', 'fly', 'owl', 'ape', 'eel', 'emu', 
    'elk', 'yak', 'koi', 'pug', 'ram', 'roo', 'cub', 'pup', 'bird', 'fish', 'bear', 'lion', 
    'wolf', 'deer', 'duck', 'swan', 'crow', 'dove', 'hawk', 'crab', 'seal', 'orca', 'goat', 
    'lamb', 'pony', 'foal', 'calf', 'hare', 'mole', 'vole', 'mice', 'moth', 'wasp', 'tick', 
    'flea', 'lice', 'slug', 'puma', 'lynx', 'zebu', 'boar', 'toad', 'frog', 'clam', 'worm', 
    'tuna', 'bass', 'carp', 'dodo', 'kiwi', 'gull', 'chimp', 'monkey', 'tiger', 'panda', 
    'koala', 'zebra', 'camel', 'llama', 'rhino', 'hippo', 'moose', 'bison', 'sloth', 'skunk', 
    'otter', 'walrus', 'badger', 'beaver', 'ferret', 'weasel', 'gopher', 'parrot', 'toucan', 
    'iguana', 'lizard', 'gecko', 'snake', 'cobra', 'viper', 'turtle', 'spider', 'beetle', 
    'mantis', 'hornet', 'coral', 'sponge', 'shrimp', 'squid', 'snail', 'oyster', 'pigeon', 
    'turkey', 'falcon', 'eagle', 'robin', 'finch', 'canary', 'macaw', 'baboon', 'gibbon', 
    'lemur', 'tapir', 'alpaca', 'vicuna', 'dingo', 'coyote', 'jackal', 'hyena', 'cougar', 
    'jaguar', 'ocelot', 'bobcat', 'wombat', 'possum', 'glider', 'pika', 'shrew', 'marten', 
    'fisher', 'stoat', 'quokka', 'numbat', 'dugong', 'beluga', 'marlin', 'mullet', 'salmon', 
    'trout', 'shark', 'ray', 'skate', 'tetra', 'guppy', 'loach', 'blenny', 'goby', 'skink', 
    'anole', 'newt', 'siren', 'peeper', 'midge', 'aphid', 'locust', 'roach', 'weevil', 
    'borer', 'miner', 'pincer', 'grubs', 'pupa', 'larva', 'urchin', 'star', 'dolphin', 
    'penguin', 'giraffe', 'octopus', 'cheetah', 'gorilla', 'platypus', 'panther', 'leopard', 
    'ostrich', 'pelican', 'peacock', 'seagull', 'vulture', 'buzzard', 'swallow', 'sparrow', 
    'warbler', 'bluejay', 'rooster', 'chicken', 'mallard', 'tadpole', 'ladybug', 'firefly', 
    'crickets', 'termite', 'bedbug', 'earwig', 'maggot', 'redbug', 'gator', 'python', 'condor',

    // Food & Drink (3-8 letters)
    'pie', 'jam', 'ham', 'egg', 'nut', 'fig', 'yam', 'pea', 'tea', 'ice', 'gum', 'bun', 
    'oat', 'rye', 'soy', 'oil', 'rib', 'cod', 'sub', 'wok', 'apple', 'pear', 'plum', 'peach', 
    'grape', 'melon', 'lemon', 'lime', 'berry', 'cherry', 'banana', 'orange', 'papaya', 
    'mango', 'tomato', 'potato', 'onion', 'garlic', 'carrot', 'celery', 'corn', 'bean', 
    'beet', 'turnip', 'radish', 'pepper', 'meat', 'beef', 'pork', 'milk', 'cheese', 'butter', 
    'bread', 'toast', 'roll', 'cake', 'tart', 'cookie', 'candy', 'mint', 'seed', 'rice', 
    'wheat', 'bran', 'soup', 'stew', 'broth', 'salad', 'taco', 'wrap', 'pizza', 'pasta', 
    'noodle', 'sushi', 'chip', 'dip', 'salsa', 'sauce', 'gravy', 'juice', 'soda', 'water', 
    'wine', 'beer', 'cola', 'icing', 'syrup', 'honey', 'sugar', 'salt', 'spice', 'herb', 
    'clove', 'basil', 'thyme', 'bacon', 'steak', 'chop', 'roast', 'filet', 'patty', 'dog', 
    'frank', 'brat', 'kebab', 'gyro', 'maki', 'sashimi', 'bento', 'ramen', 'udon', 'soba', 
    'pho', 'pad', 'curry', 'dal', 'naan', 'pita', 'bagel', 'scone', 'muffin', 'waffle', 
    'crepe', 'blini', 'frites', 'fries', 'mash', 'hash', 'rosti', 'gratin', 'quiche', 
    'omelet', 'flan', 'mousse', 'jelly', 'jello', 'fudge', 'toffee', 'taffy', 'nugget', 
    'truffle', 'fondue', 'sorbet', 'gelato', 'sundae', 'split', 'float', 'shake', 'malt', 
    'latte', 'mocha', 'decaf', 'boba', 'cider', 'punch', 'cocoa', 'stock', 'puree', 'paste', 
    'curd', 'cream', 'whey', 'ziti', 'penne', 'mac', 'gnocchi', 'ravioli', 'pesto', 'ragu', 
    'aioli', 'mayo', 'mustard', 'relish', 'caper', 'olive', 'pickle', 'kimchi', 'kraut', 
    'jerky', 'biltong', 'salami', 'chorizo', 'lox', 'roe', 'caviar', 'pretzel', 'burrito', 
    'pancake', 'donut', 'cupcake', 'popcorn', 'nachos', 'avocado', 'hotdog', 'burger', 
    'sausage', 'oatmeal', 'cereal', 'yogurt', 'pudding', 'biscuit', 'cracker', 'peanut', 
    'almond', 'walnut', 'pecan', 'cashew', 'pumpkin', 'squash', 'cabbage', 'lettuce', 
    'spinach', 'broccoli', 'ketchup', 'vinegar', 'vanilla', 'extract', 'flavor', 'frosting', 
    'brownie', 'strudel', 'pastry', 'eclair', 'tartlet', 'cobbler', 'crumpet', 'biscoti',

    // Body & People (3-8 letters)
    'eye', 'ear', 'lip', 'jaw', 'arm', 'leg', 'toe', 'rib', 'hip', 'lap', 'gum', 'lid', 
    'boy', 'man', 'girl', 'lady', 'baby', 'kid', 'mom', 'dad', 'son', 'head', 'hair', 'face', 
    'nose', 'mouth', 'tooth', 'teeth', 'chin', 'cheek', 'neck', 'back', 'spine', 'chest', 
    'bust', 'belly', 'waist', 'groin', 'hand', 'palm', 'wrist', 'thumb', 'nail', 'fist', 
    'knee', 'calf', 'shin', 'foot', 'feet', 'heel', 'arch', 'sole', 'skin', 'bone', 'flesh', 
    'blood', 'vein', 'heart', 'lung', 'brain', 'mind', 'skull', 'liver', 'gut', 'stomach', 
    'nerve', 'muscle', 'bicep', 'organ', 'gland', 'tear', 'sweat', 'spit', 'snot', 'puke', 
    'burp', 'fart', 'yawn', 'sigh', 'wink', 'blink', 'smile', 'frown', 'smirk', 'pout', 
    'glare', 'stare', 'gaze', 'peek', 'glance', 'king', 'queen', 'prince', 'lord', 'duke', 
    'earl', 'knight', 'page', 'maid', 'chef', 'cook', 'baker', 'smith', 'mason', 'miner', 
    'guard', 'cop', 'spy', 'thief', 'hero', 'idol', 'star', 'fan', 'boss', 'chief', 'mate', 
    'crew', 'team', 'host', 'guest', 'bride', 'groom', 'wife', 'aunt', 'uncle', 'niece', 
    'twin', 'clone', 'dwarf', 'giant', 'elf', 'orc', 'fairy', 'angel', 'demon', 'devil', 
    'ghost', 'ghoul', 'mummy', 'monk', 'nun', 'pope', 'priest', 'rabbi', 'guru', 'yogi', 
    'saint', 'sinner', 'buddy', 'pal', 'friend', 'enemy', 'foe', 'rival', 'ally', 'scout', 
    'guide', 'pilot', 'diver', 'rider', 'racer', 'boxer', 'ninja', 'student', 'teacher', 
    'doctor', 'nurse', 'vet', 'farmer', 'driver', 'singer', 'dancer', 'actor', 'artist', 
    'writer', 'poet', 'player', 'runner', 'jumper', 'walker', 'talker', 'helper', 'worker', 
    'leader', 'ruler', 'mayor', 'judge', 'jury', 'lawyer', 'client', 'buyer', 'seller', 
    'clerk', 'agent', 'broker', 'dealer', 'owner', 'renter', 'tenant', 'neighbor', 'citizen', 
    'person', 'human', 'alien', 'mutant', 'cyborg', 'robot', 'monster', 'vampire', 'zombie', 
    'dragon', 'wizard', 'witch', 'warlock', 'goblin', 'troll', 'ogre', 'siren', 'mermaid', 
    'centaur', 'griffin',

    // Nature & Outdoors (3-8 letters)
    'sun', 'sky', 'air', 'sea', 'ice', 'fog', 'dew', 'sap', 'ash', 'mud', 'clay', 'dirt', 
    'soil', 'dust', 'sand', 'rock', 'stone', 'gem', 'ore', 'coal', 'gold', 'iron', 'lead', 
    'tin', 'zinc', 'moon', 'planet', 'comet', 'meteor', 'orbit', 'space', 'void', 'black', 
    'hole', 'galaxy', 'nebula', 'earth', 'globe', 'map', 'pole', 'axis', 'equator', 'tropic', 
    'zone', 'land', 'mass', 'island', 'isle', 'atoll', 'reef', 'coast', 'shore', 'beach', 
    'bank', 'cliff', 'cape', 'bay', 'gulf', 'cove', 'inlet', 'fjord', 'sound', 'strait', 
    'ocean', 'lake', 'pond', 'pool', 'mere', 'tarn', 'loch', 'river', 'stream', 'creek', 
    'brook', 'rill', 'fall', 'rapid', 'eddy', 'tide', 'wave', 'surf', 'swell', 'crest', 
    'foam', 'spray', 'wind', 'gale', 'breeze', 'gust', 'draft', 'storm', 'rain', 'snow', 
    'hail', 'sleet', 'frost', 'chill', 'cold', 'heat', 'warm', 'hot', 'fire', 'flame', 
    'spark', 'ember', 'flare', 'blaze', 'smoke', 'soot', 'smog', 'haze', 'mist', 'cloud', 
    'thunder', 'bolt', 'flash', 'ray', 'beam', 'light', 'dark', 'shadow', 'shade', 'gloom', 
    'dusk', 'dawn', 'morn', 'noon', 'night', 'eve', 'day', 'week', 'month', 'year', 'time', 
    'era', 'age', 'epoch', 'eon', 'past', 'now', 'leaf', 'stem', 'root', 'bark', 'branch', 
    'twig', 'log', 'wood', 'tree', 'bush', 'shrub', 'vine', 'weed', 'grass', 'fern', 'moss', 
    'reed', 'rush', 'lily', 'rose', 'daisy', 'tulip', 'iris', 'orchid', 'lotus', 'poppy', 
    'aster', 'pansy', 'flora', 'fauna', 'biome', 'tundra', 'desert', 'plain', 'field', 
    'meadow', 'pasture', 'forest', 'woods', 'jungle', 'canopy', 'swamp', 'marsh', 'bog', 
    'fen', 'moor', 'hill', 'mound', 'dune', 'peak', 'apex', 'ridge', 'spur', 'pass', 'gap', 
    'gorge', 'canyon', 'valley', 'basin', 'cave', 'cavern', 'grotto', 'mine', 'pit', 'den', 
    'lair', 'nest', 'web', 'hive', 'crater', 'geyser', 'volcano', 'magma', 'lava', 'pumice', 
    'basalt', 'quartz', 'flint', 'chert', 'slate', 'shale', 'marble', 'granite', 'gravel', 
    'pebble', 'boulder', 'fossil', 'amber', 'resin', 'spore', 'pollen', 'nectar', 'petal', 
    'sepal', 'thorn', 'briar', 'bramble', 'thicket', 'grove', 'copse', 'timber', 'lumber',

    // Clothing & Accessories (3-8 letters)
    'hat', 'cap', 'wig', 'bow', 'tie', 'pin', 'bag', 'tag', 'top', 'bra', 'tee', 'tux', 
    'suit', 'coat', 'vest', 'robe', 'gown', 'dress', 'skirt', 'kilt', 'pants', 'jeans', 
    'slacks', 'shorts', 'sock', 'shoe', 'boot', 'clog', 'pump', 'flat', 'heel', 'lace', 
    'spur', 'cuff', 'sleeve', 'collar', 'lapel', 'seam', 'hem', 'zip', 'snap', 'hook', 
    'ring', 'band', 'belt', 'sash', 'scarf', 'shawl', 'wrap', 'cape', 'hood', 'mask', 
    'veil', 'glove', 'mitt', 'muff', 'watch', 'chain', 'bead', 'stud', 'jewel', 'pearl', 
    'jade', 'opal', 'ruby', 'crown', 'tiara', 'halo', 'badge', 'medal', 'ribbon', 'award', 
    'prize', 'purse', 'wallet', 'pack', 'sack', 'tote', 'pouch', 'strap', 'buckle', 'clasp', 
    'cloth', 'silk', 'wool', 'yarn', 'knit', 'weave', 'spun', 'felt', 'hide', 'pelt', 'fur', 
    'leather', 'suede', 'denim', 'linen', 'cotton', 'nylon', 'rayon', 'mesh', 'net', 'frill', 
    'pleat', 'tuck', 'fold', 'crease', 'stain', 'spot', 'hole', 'rip', 'tear', 'patch', 
    'mend', 'wash', 'iron', 'wear', 'fit', 'size', 'small', 'large', 'tight', 'loose', 
    'baggy', 'trim', 'neat', 'tidy', 'smart', 'chic', 'retro', 'boho', 'mod', 'punk', 'goth', 
    'prep', 'jock', 'nerd', 'geek', 'cool', 'rad', 'fly', 'ugly', 'plain', 'drab', 'dull', 
    'sneaker', 'slipper', 'sandal', 'loafer', 'oxford', 'blazer', 'jacket', 'sweater', 
    'jumper', 'hoodie', 'poncho', 'anorak', 'parka', 'fleece', 'pyjamas', 'onesie', 'bikini', 
    'trunks', 'briefs', 'boxers', 'tights', 'hosiery', 'socks', 'boots', 'crocs', 'shades', 
    'glasses', 'lenses', 'frames', 'bangle', 'anklet', 'choker', 'pendant', 'locket', 
    'brooch', 'earring', 'hoop', 'barrette', 'hairpin', 'clip', 'scrunch', 'thread', 'needle', 
    'thimble', 'button', 'zipper', 'velcro', 'pocket', 'lining', 'pattern', 'stripe', 
    'check', 'plaid', 'polka', 'dot', 'floral', 'print', 'logo', 'brand',

    // Home, Furniture & Architecture (3-8 letters)
    'house', 'home', 'flat', 'condo', 'hut', 'tent', 'camp', 'yurt', 'shed', 'barn', 'silo', 
    'mill', 'fort', 'base', 'post', 'wall', 'roof', 'floor', 'door', 'gate', 'arch', 'porch', 
    'deck', 'patio', 'yard', 'lawn', 'path', 'walk', 'steps', 'stair', 'ramp', 'rail', 
    'fence', 'wire', 'pipe', 'tube', 'duct', 'vent', 'fan', 'pump', 'tank', 'well', 'sink', 
    'tub', 'bath', 'shower', 'loo', 'toilet', 'bidet', 'basin', 'mirror', 'glass', 'pane', 
    'frame', 'sill', 'blind', 'shade', 'drape', 'rug', 'mat', 'pad', 'tile', 'wood', 'brick', 
    'stone', 'slate', 'beam', 'joist', 'lath', 'board', 'plank', 'shelf', 'rack', 'peg', 
    'screw', 'bolt', 'nut', 'hinge', 'lock', 'key', 'knob', 'dial', 'switch', 'plug', 
    'cord', 'bulb', 'lamp', 'light', 'grate', 'stove', 'oven', 'pot', 'pan', 'dish', 'bowl', 
    'cup', 'mug', 'jug', 'jar', 'lid', 'cork', 'seal', 'foil', 'bin', 'can', 'trash', 
    'waste', 'sweep', 'mop', 'dust', 'wipe', 'clean', 'dry', 'sort', 'mess', 'dirt', 'grime', 
    'spill', 'leak', 'drip', 'drop', 'puddle', 'sponge', 'soap', 'suds', 'rinse', 'towel', 
    'rag', 'duster', 'broom', 'brush', 'comb', 'pick', 'file', 'snip', 'cut', 'shave', 
    'razor', 'blade', 'gel', 'floss', 'bed', 'cot', 'crib', 'bunk', 'futon', 'sofa', 'couch', 
    'seat', 'chair', 'stool', 'bench', 'pew', 'desk', 'table', 'stand', 'cart', 'tray', 
    'box', 'case', 'chest', 'trunk', 'safe', 'vault', 'draw', 'till', 'coin', 'cash', 'note', 
    'bill', 'card', 'bank', 'clock', 'face', 'hand', 'tick', 'tock', 'chime', 'bell', 'gong', 
    'horn', 'beep', 'buzz', 'hum', 'whir', 'purr', 'roar', 'hiss', 'pop', 'bang', 'crash', 
    'smash', 'crack', 'slice', 'dice', 'mince', 'mash', 'blend', 'mix', 'stir', 'whip', 
    'beat', 'knead', 'press', 'squeeze', 'juice', 'strain', 'sift', 'peel', 'pare', 'core', 
    'pit', 'hull', 'husk', 'shell', 'open', 'shut', 'close', 'bar', 'tape', 'glue', 'stick', 
    'bind', 'knot', 'loop', 'string', 'rope', 'twine', 'cable', 'chain', 'link', 'washer', 
    'cog', 'gear', 'wheel', 'tire', 'rim', 'hub', 'spoke', 'axle', 'shaft', 'drive', 'motor', 
    'engine', 'blow', 'suck', 'vac', 'hose', 'valve', 'tap', 'bedroom', 'kitchen', 'hallway', 
    'closet', 'pantry', 'cellar', 'attic', 'garage', 'garden', 'balcony', 'window', 'chimney', 
    'hearth', 'mantel', 'cushion', 'pillow', 'blanket', 'duvet', 'quilt', 'sheet', 'mattress', 
    'toaster', 'blender', 'kettle', 'teapot', 'saucer', 'plate', 'fork', 'spoon', 'knife', 
    'napkin', 'apron', 'gloves', 'bucket', 'spade', 'shovel', 'rake', 'hoe', 'trowel', 
    'shears', 'mower', 'spray', 'city', 'town', 'village', 'street', 'road', 'lane', 'alley', 
    'ave', 'blvd', 'park', 'square', 'plaza', 'mall', 'shop', 'store', 'mart', 'market', 
    'office', 'school', 'class', 'room', 'hall', 'gym', 'court', 'field', 'farm', 'guard', 
    'tower', 'bridge', 'tunnel', 'plaza',

    // Tools, Tech & Objects (3-8 letters)
    'tool', 'kit', 'hammer', 'mallet', 'club', 'bat', 'stick', 'pole', 'rod', 'staff', 
    'wand', 'cane', 'crop', 'whip', 'lash', 'line', 'thread', 'cable', 'pipe', 'duct', 
    'button', 'pad', 'screen', 'touch', 'swipe', 'click', 'hold', 'drag', 'folder', 'doc', 
    'text', 'word', 'page', 'book', 'tome', 'scroll', 'map', 'chart', 'graph', 'plot', 
    'plan', 'draft', 'sketch', 'draw', 'paint', 'pen', 'ink', 'dye', 'hue', 'tint', 'tone', 
    'color', 'red', 'blue', 'pink', 'cyan', 'teal', 'gold', 'grey', 'pale', 'deep', 'rich', 
    'bold', 'loud', 'soft', 'mute', 'quiet', 'still', 'calm', 'drill', 'saw', 'rasp', 
    'plane', 'chisel', 'punch', 'awl', 'vise', 'clamp', 'pliers', 'wrench', 'socket', 
    'ratchet', 'driver', 'staple', 'rivet', 'weld', 'solder', 'iron', 'forge', 'anvil', 
    'tong', 'bellows', 'mold', 'cast', 'lathe', 'stamp', 'sheer', 'scissor', 'axe', 'adze', 
    'mattock', 'dibble', 'pruner', 'lopper', 'shear', 'scythe', 'sickle', 'flail', 'thresher', 
    'baler', 'plow', 'harrow', 'seeder', 'reaper', 'binder', 'wagon', 'sled', 'barrow', 
    'truck', 'lift', 'crane', 'hoist', 'winch', 'block', 'tackle', 'pulley', 'filter', 
    'sieve', 'trap', 'snare', 'sinker', 'bobber', 'float', 'lure', 'bait', 'chum', 'reel', 
    'gaff', 'creel', 'phone', 'smart', 'tablet', 'laptop', 'pc', 'mouse', 'cursor', 'wifi', 
    'site', 'code', 'app', 'byte', 'data', 'node', 'network', 'server', 'router', 'modem', 
    'pixel', 'image', 'photo', 'video', 'audio', 'sound', 'track', 'disk', 'memory', 
    'flash', 'laser', 'optic', 'lens', 'focus', 'zoom', 'tilt', 'shoot', 'print', 'copy', 
    'scan', 'fax', 'send', 'recv', 'mail', 'chat', 'talk', 'type', 'read', 'write', 'edit', 
    'save', 'load', 'boot', 'quit', 'exit', 'play', 'pause', 'stop', 'rec', 'fwd', 'rwd', 
    'skip', 'umbrella', 'telescope', 'micro', 'scope', 'backpack', 'hammock', 'compass', 
    'trophy', 'megaphone', 'library', 'volcano', 'pyramid', 'igloo', 'stadium', 'hospital', 
    'aquarium', 'factory', 'windmill',

    // Vehicles & Transport (3-8 letters)
    'car', 'auto', 'taxi', 'cab', 'bus', 'van', 'semi', 'rig', 'jeep', 'suv', 'tram', 
    'train', 'rail', 'metro', 'bike', 'trike', 'quad', 'moto', 'moped', 'scoot', 'skate', 
    'ski', 'luge', 'boat', 'ship', 'sub', 'yacht', 'skiff', 'scow', 'raft', 'buoy', 'dock', 
    'pier', 'port', 'helm', 'sail', 'mast', 'keel', 'bow', 'stern', 'star', 'soar', 'glide', 
    'wing', 'prop', 'jet', 'plane', 'craft', 'ufo', 'pod', 'drone', 'kite', 'blimp', 'zepp', 
    'dart', 'arrow', 'shot', 'slug', 'shell', 'bomb', 'nuke', 'mine', 'cage', 'pen', 'coop', 
    'hutch', 'scooter', 'cycle', 'exhaust', 'brake', 'pedal', 'clutch', 'shift', 'steer', 
    'bumper', 'fender', 'gauge', 'meter', 'radio', 'siren', 'alarm', 'sign', 'yield', 'fast', 
    'slow', 'speed', 'race', 'drag', 'drift', 'skid', 'dent', 'ding', 'scratch', 'rust', 
    'wax', 'polish', 'shine', 'gleam', 'glow',

    // Sports, Hobbies, Actions & Abstract (3-8 letters)
    'game', 'sport', 'toy', 'doll', 'block', 'ball', 'mitt', 'hoop', 'goal', 'puck', 
    'club', 'tee', 'hole', 'flag', 'cup', 'dart', 'board', 'card', 'dice', 'chip', 'pawn', 
    'piece', 'rook', 'mate', 'win', 'lose', 'draw', 'tie', 'beat', 'score', 'point', 'mark', 
    'rule', 'foul', 'out', 'safe', 'hit', 'miss', 'catch', 'throw', 'pass', 'kick', 'punt', 
    'slip', 'trip', 'slide', 'run', 'walk', 'jump', 'leap', 'hop', 'skip', 'dive', 'swim', 
    'drown', 'tennis', 'soccer', 'rugby', 'golf', 'polo', 'jog', 'dash', 'sprint', 'track', 
    'pitch', 'rink', 'gym', 'dojo', 'spar', 'wrestle', 'fence', 'bout', 'match', 'rally', 
    'tour', 'medal', 'prize', 'award', 'wreath', 'champ', 'victor', 'cheer', 'clap', 'boo', 
    'jeer', 'taunt', 'chant', 'sing', 'song', 'tune', 'note', 'rhythm', 'dance', 'step', 
    'move', 'turn', 'spin', 'twirl', 'pose', 'flex', 'stretch', 'bend', 'curtsey', 'kneel', 
    'sit', 'stand', 'lay', 'rest', 'sleep', 'nap', 'wake', 'dream', 'think', 'ponder', 
    'muse', 'guess', 'know', 'learn', 'study', 'sculpt', 'carve', 'build', 'make', 'craft', 
    'sew', 'paper', 'plastic', 'magic', 'spell', 'charm', 'curse', 'hex', 'jinx', 'wish', 
    'hope', 'fear', 'love', 'hate', 'anger', 'rage', 'fury', 'wrath', 'joy', 'bliss', 'peace', 
    'noise', 'music', 'rhyme', 'poem', 'story', 'tale', 'myth', 'legend', 'fable', 'joke', 
    'pun', 'wit', 'humor', 'fun', 'law', 'act', 'bill', 'pact', 'treaty', 'deal', 'bond', 
    'vow', 'oath', 'truth', 'lie', 'fib', 'fake', 'sham', 'hoax', 'trick', 'mars', 'venus', 
    'pluto', 'god', 'super', 'cowl', 'power', 'force', 'blast', 'boom', 'slap', 'smack', 
    'slash', 'stab', 'burn', 'melt', 'freeze', 'mild', 'harsh', 'hard', 'firm', 'weak', 
    'strong', 'frail', 'stout', 'thick', 'thin', 'fat', 'slim', 'lean', 'fair', 'tan', 
    'poor', 'broke', 'flush', 'full', 'empty', 'bare', 'blank', 'null', 'zero', 'none', 
    'all', 'some', 'few', 'many', 'lot', 'ton', 'heap', 'pile', 'stack', 'bunch', 'group', 
    'gasp', 'choke', 'cough', 'sneeze', 'sniff', 'pant', 'puff', 'huff', 'moan', 'groan', 
    'weep', 'cry', 'sob', 'wail', 'howl', 'yell', 'shout', 'scream', 'bark', 'yap', 'yip', 
    'meow', 'purr', 'bite', 'chew', 'lick', 'suck', 'sip', 'gulp', 'swallow', 'belch', 
    'drool', 'bleed', 'heal', 'cure', 'hurt', 'ache', 'pain', 'sting', 'itch', 'scrub', 
    'scour', 'pack', 'wrap', 'pry', 'pull', 'push', 'shove', 'lift', 'heave', 'haul', 
    'toss', 'hurl', 'grab', 'keep', 'save', 'find', 'seek', 'hide', 'look', 'see', 'squint', 
    'grin', 'sneer', 'laugh', 'giggle', 'chuck', 'chuckle', 'snort', 'snicker', 'guffaw', 
    'chortle', 'bawl', 'whine', 'grumble', 'mumble', 'mutter', 'whisper', 'speak', 'say', 
    'tell', 'ask', 'beg', 'plead', 'demand', 'order', 'command', 'govern', 'lead', 'guide', 
    'show', 'teach', 'tally', 'count', 'add', 'sum', 'minus', 'less', 'more', 'part', 'half', 
    'whole', 'rainbow', 'eclipse', 'tornado', 'tsunami', 'blizzard', 'mirage', 'gravity', 
    'silence', 'vampire', 'alien', 'phoenix', 'ninja', 'pirate', 'wizard', 'dragon', 'zombie'
  ]
};
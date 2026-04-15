// src/context/GameContext.js
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import {
  signInWithGoogle, getGoogleRedirectResult, signOutUser, listenRoom, listenChat,
  setUserOnline, removeUserOnline, checkNameAvailableForUid, joinRoom,
  updatePlayerNameInRoom,
} from '../firebase/services';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getStoredSession, clearSession } from '../hooks/useGameSession';

const GameContext = createContext(null);

const STORAGE_KEY = 'celebrations_player_name';

const initialState = {
  userId:      null,
  userEmail:   null,   // from Google account
  isAuthReady: false,
  playerName:  null,
  isLoggedIn:  false,
  roomId:      null,
  room:        null,
  me:          null,
  isHost:      false,
  isDrawer:    false,
  chat:        [],
  notification: null,
  isLoading:   false,
  error:       null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH':
      return { ...state, userId: action.userId, userEmail: action.userEmail ?? null, isAuthReady: true };
    case 'SET_LOGGED_IN':
      return { ...state, playerName: action.name, isLoggedIn: true };
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.name };
    case 'LOGOUT':
      return { ...state, playerName: null, isLoggedIn: false, roomId: null, room: null,
               userId: null, userEmail: null, isAuthReady: true };
    case 'SET_ROOM_ID':   return { ...state, roomId: action.roomId };
    case 'SET_ROOM': {
      const me       = action.room?.players?.[state.userId] || null;
      const isHost   = action.room?.hostId === state.userId;
      const isDrawer = action.room?.currentDrawer === state.userId;
      return { ...state, room: action.room, me, isHost, isDrawer };
    }
    case 'SET_CHAT':         return { ...state, chat: action.chat };
    case 'SET_LOADING':      return { ...state, isLoading: action.value };
    case 'SET_ERROR':        return { ...state, error: action.error };
    case 'SET_NOTIFICATION': return { ...state, notification: action.notification };
    case 'LEAVE_ROOM':
      return { ...state, roomId: null, room: null, me: null, isHost: false, isDrawer: false, chat: [] };
    default: return state;
  }
}

/** Extract the full display name from Google account, falling back to email local-part. */
function extractFullName(user) {
  if (user.displayName) {
    return user.displayName.trim();
  }
  if (user.email) {
    return user.email.split('@')[0].replace(/[^A-Za-z0-9]/g, '');
  }
  return 'Player';
}

/** Find a unique display name for the user: first name, then FirstName2, FirstName3 … */
async function resolveUniqueName(uid, baseName) {
  // Returning user: restore their saved name from localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;

  // New session: find an available variant of their first name
  let name = baseName;
  let counter = 2;
  // Allow up to 20 attempts before giving up and appending uid suffix
  while (counter <= 20) {
    const available = await checkNameAvailableForUid(name, uid);
    if (available) return name;
    name = `${baseName}${counter}`;
    counter++;
  }
  // Fallback: baseName + last 4 chars of uid
  return `${baseName}${uid.slice(-4)}`;
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubRoomRef = useRef(null);
  const unsubChatRef = useRef(null);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    // Handle the result when Firebase redirects back after Google sign-in
    getGoogleRedirectResult().catch(() => {
      // Ignore errors here — onAuthStateChanged handles the actual auth state
    });

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const firstName = extractFullName(user);
        dispatch({ type: 'SET_AUTH', userId: user.uid, userEmail: user.email });

        try {
          const name = await resolveUniqueName(user.uid, firstName);
          await setUserOnline(user.uid, name);
          localStorage.setItem(STORAGE_KEY, name);
          dispatch({ type: 'SET_LOGGED_IN', name });

          // ── Auto-rejoin: if a session was saved, silently try to re-enter the room
          const session = getStoredSession();
          if (session?.roomId) {
            try {
              await joinRoom(session.roomId, name);
              dispatch({ type: 'SET_ROOM_ID', roomId: session.roomId });
              // Session stays active (room listener will keep it refreshed)
              // Don't clearSession here — it will be refreshed by useGameGuard
            } catch {
              // Room is gone or we were kicked — clear the stale session silently
              clearSession();
            }
          }
        } catch {
          // Auth is ready but setup failed — LoginScreen will show
        }
      } else {
        dispatch({ type: 'SET_AUTH', userId: null, userEmail: null });
      }
    });
    return unsub;
  }, []);

  // ── Room listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.roomId) return;
    if (unsubRoomRef.current) unsubRoomRef.current();
    if (unsubChatRef.current) unsubChatRef.current();

    unsubRoomRef.current = listenRoom(state.roomId, (room) => {
      dispatch({ type: 'SET_ROOM', room });
    });
    unsubChatRef.current = listenChat(state.roomId, (chat) => {
      dispatch({ type: 'SET_CHAT', chat });
    });
    return () => {
      if (unsubRoomRef.current) unsubRoomRef.current();
      if (unsubChatRef.current) unsubChatRef.current();
    };
  }, [state.roomId]);

  const setRoomId  = (id) => dispatch({ type: 'SET_ROOM_ID', roomId: id });
  const leaveRoom  = () => dispatch({ type: 'LEAVE_ROOM' });
  const setLoading = (v) => dispatch({ type: 'SET_LOADING', value: v });
  const setError   = (e) => dispatch({ type: 'SET_ERROR', error: e });
  const notify     = (msg) => {
    dispatch({ type: 'SET_NOTIFICATION', notification: msg });
    setTimeout(() => dispatch({ type: 'SET_NOTIFICATION', notification: null }), 3000);
  };

  /** Update the player's username — validates uniqueness, persists everywhere */
  const updateUsername = async (newName) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Username cannot be empty');
    if (trimmed.length < 2)  throw new Error('Username must be at least 2 characters');
    if (trimmed.length > 20) throw new Error('Username must be 20 characters or less');
    if (!/^[A-Za-z0-9_ ]+$/.test(trimmed))
      throw new Error('Only letters, numbers, spaces and underscores allowed');

    // Check availability (exclude self)
    const available = await checkNameAvailableForUid(trimmed, state.userId);
    if (!available) throw new Error('That name is already taken');

    await updatePlayerNameInRoom(state.userId, state.roomId, trimmed);
    localStorage.setItem(STORAGE_KEY, trimmed);
    dispatch({ type: 'SET_PLAYER_NAME', name: trimmed });
  };

  /** Trigger Google sign-in redirect — called from LoginScreen */
  const loginWithGoogle = async () => {
    dispatch({ type: 'SET_LOADING', value: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      await signInWithGoogle();
      // Page will redirect to Google — onAuthStateChanged fires when it comes back
    } catch (err) {
      const msg = err.message || 'Sign-in failed';
      dispatch({ type: 'SET_ERROR', error: msg });
      dispatch({ type: 'SET_LOADING', value: false });
    }
  };

  /** Sign out completely */
  const logout = async () => {
    if (state.userId) await removeUserOnline(state.userId).catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    await signOutUser();
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <GameContext.Provider value={{
      state, setRoomId, leaveRoom, setLoading, setError, notify,
      loginWithGoogle, logout, updateUsername,
      // keep loginWithName as no-op alias so any existing callers don't crash
      loginWithName: async () => {},
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGameContext = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext must be used within GameProvider');
  return ctx;
};
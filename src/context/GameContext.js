// src/context/GameContext.js
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import {
  signInWithGoogle, signOutUser, listenRoom, listenChat,
  setUserOnline, removeUserOnline, checkNameAvailableForUid,
} from '../firebase/services';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

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

/** Extract first name from Google displayName, falling back to email local-part. */
function extractFirstName(user) {
  if (user.displayName) {
    return user.displayName.split(' ')[0].trim();
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const firstName = extractFirstName(user);
        dispatch({ type: 'SET_AUTH', userId: user.uid, userEmail: user.email });

        try {
          const name = await resolveUniqueName(user.uid, firstName);
          await setUserOnline(user.uid, name);
          localStorage.setItem(STORAGE_KEY, name);
          dispatch({ type: 'SET_LOGGED_IN', name });
        } catch {
          // Auth is ready but name registration failed — LoginScreen will show
        }
      } else {
        // No session active — LoginScreen prompts Google sign-in
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

  /** Trigger Google sign-in popup — called from LoginScreen */
  const loginWithGoogle = async () => {
    dispatch({ type: 'SET_LOADING', value: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      await signInWithGoogle();
      // onAuthStateChanged fires automatically after this and handles the rest
    } catch (err) {
      const msg = err.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled'
        : err.message || 'Sign-in failed';
      dispatch({ type: 'SET_ERROR', error: msg });
    } finally {
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
      loginWithGoogle, logout,
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

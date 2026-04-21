// src/context/GameContext.js
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import {
  signInWithGoogle, signInAnonymouslyUser, signOutUser, listenRoom, listenChat,
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
  userEmail:   null,
  isAnonymous: false,
  isAuthReady: false,
  playerName:  null,
  isLoggedIn:  false,
  roomId:      null,
  room:        null,
  me:          null,
  isHost:      false,
  isDrawer:    false,
  chat:        [],
  // FIX: notification is now { msg, type } or null (was bare string)
  notification: null,
  isLoading:   false,
  isAuthLoading: false,
  error:       null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH':
      return { ...state, userId: action.userId, userEmail: action.userEmail ?? null,
               isAnonymous: action.isAnonymous ?? false, isAuthReady: true };
    case 'SET_LOGGED_IN':
      return { ...state, playerName: action.name, isLoggedIn: true };
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.name };
    case 'LOGOUT':
      return { ...state, playerName: null, isLoggedIn: false, roomId: null, room: null,
               userId: null, userEmail: null, isAnonymous: false, isAuthReady: true };
    case 'SET_ROOM_ID':   return { ...state, roomId: action.roomId };
    case 'SET_ROOM': {
      const me       = action.room?.players?.[state.userId] || null;
      const isHost   = action.room?.hostId === state.userId;
      const isDrawer = action.room?.currentDrawer === state.userId;
      return { ...state, room: action.room, me, isHost, isDrawer };
    }
    case 'SET_CHAT':         return { ...state, chat: action.chat };
    case 'SET_LOADING':      return { ...state, isLoading: action.value };
    case 'SET_AUTH_LOADING': return { ...state, isAuthLoading: action.value };
    case 'SET_ERROR':        return { ...state, error: action.error };
    case 'SET_NOTIFICATION': return { ...state, notification: action.notification };
    case 'LEAVE_ROOM':
      return { ...state, roomId: null, room: null, me: null, isHost: false, isDrawer: false, chat: [] };
    default: return state;
  }
}

function extractFullName(user) {
  if (user.displayName) return user.displayName.trim();
  if (user.email) return user.email.split('@')[0].replace(/[^A-Za-z0-9]/g, '');
  return 'Guest';
}

async function resolveUniqueName(uid, baseName) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    if (!saved.startsWith('Guest')) return saved;
    const available = await checkNameAvailableForUid(saved, uid);
    if (available) return saved;
  }
  let name = baseName;
  let counter = 2;
  while (counter <= 20) {
    const available = await checkNameAvailableForUid(name, uid);
    if (available) return name;
    name = `${baseName}${counter}`;
    counter++;
  }
  return `${baseName}${uid.slice(-4)}`;
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubRoomRef = useRef(null);
  const unsubChatRef = useRef(null);
  // FIX: store the host-leave timer so it can be cancelled on cleanup
  const hostLeaveTimerRef = useRef(null);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const pendingGuestName = sessionStorage.getItem('pending_guest_name');
        if (user.isAnonymous && pendingGuestName) {
          dispatch({ type: 'SET_AUTH', userId: user.uid, userEmail: user.email, isAnonymous: true });
          return;
        }

        const firstName = extractFullName(user);
        dispatch({ type: 'SET_AUTH', userId: user.uid, userEmail: user.email, isAnonymous: user.isAnonymous });

        try {
          const savedName = localStorage.getItem(STORAGE_KEY);
          let name;
          if (savedName) {
            const available = await checkNameAvailableForUid(savedName, user.uid);
            name = available ? savedName : await resolveUniqueName(user.uid, firstName);
          } else {
            name = await resolveUniqueName(user.uid, firstName);
          }

          await setUserOnline(user.uid, name);
          localStorage.setItem(STORAGE_KEY, name);
          dispatch({ type: 'SET_LOGGED_IN', name });
          dispatch({ type: 'SET_AUTH_LOADING', value: false });

          const session = getStoredSession();
          if (session?.roomId) {
            try {
              await joinRoom(session.roomId, name);
              dispatch({ type: 'SET_ROOM_ID', roomId: session.roomId });
            } catch (e) {
              console.error('Auto-rejoin failed:', e);
              clearSession();
            }
          }
        } catch (e) {
          console.error('User setup failed:', e);
          dispatch({ type: 'SET_AUTH_LOADING', value: false });
        }
      } else {
        dispatch({ type: 'SET_AUTH', userId: null, userEmail: null, isAnonymous: false });
        dispatch({ type: 'SET_AUTH_LOADING', value: false });
      }
    });
    return unsub;
  }, []);

  // ── Room listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.roomId) return;
    if (unsubRoomRef.current) unsubRoomRef.current();
    if (unsubChatRef.current) unsubChatRef.current();

    // Capture stable refs to avoid stale-closure dispatches
    const currentUserId = state.userId;

    unsubRoomRef.current = listenRoom(state.roomId, (room) => {
      if (!room) {
        // FIX: clear any pending host-leave timer before dispatching
        clearTimeout(hostLeaveTimerRef.current);
        dispatch({ type: 'SET_NOTIFICATION', notification: { msg: 'The host ended the game.', type: 'info' } });
        setTimeout(() => dispatch({ type: 'SET_NOTIFICATION', notification: null }), 3000);
        dispatch({ type: 'LEAVE_ROOM' });
        return;
      }
      if (room.hostId && room.hostId !== currentUserId && !room.players?.[room.hostId]) {
        dispatch({ type: 'SET_NOTIFICATION', notification: { msg: 'The host has left. Returning home…', type: 'info' } });
        setTimeout(() => dispatch({ type: 'SET_NOTIFICATION', notification: null }), 3000);
        // FIX: store timer ref so cleanup can cancel it
        clearTimeout(hostLeaveTimerRef.current);
        hostLeaveTimerRef.current = setTimeout(() => dispatch({ type: 'LEAVE_ROOM' }), 2000);
      }
      dispatch({ type: 'SET_ROOM', room });
    });
    unsubChatRef.current = listenChat(state.roomId, (chat) => {
      dispatch({ type: 'SET_CHAT', chat });
    });

    return () => {
      // FIX: cancel the host-leave timer on cleanup to prevent dispatch after unmount
      clearTimeout(hostLeaveTimerRef.current);
      if (unsubRoomRef.current) unsubRoomRef.current();
      if (unsubChatRef.current) unsubChatRef.current();
    };
  }, [state.roomId, state.userId]);

  const setRoomId  = (id) => dispatch({ type: 'SET_ROOM_ID', roomId: id });
  const leaveRoom  = () => dispatch({ type: 'LEAVE_ROOM' });
  const setLoading = (v) => dispatch({ type: 'SET_LOADING', value: v });
  const setError   = (e) => dispatch({ type: 'SET_ERROR', error: e });

  // FIX: notify now accepts an optional type ('info' | 'error' | 'success')
  // Backward-compatible: callers passing only a string still work fine.
  const notify = (msg, type = 'info') => {
    dispatch({ type: 'SET_NOTIFICATION', notification: { msg, type } });
    setTimeout(() => dispatch({ type: 'SET_NOTIFICATION', notification: null }), 3000);
  };

  const updateUsername = async (newName) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Username cannot be empty');
    if (trimmed.length < 2)  throw new Error('Username must be at least 2 characters');
    if (trimmed.length > 20) throw new Error('Username must be 20 characters or less');
    if (!/^[A-Za-z0-9_ ]+$/.test(trimmed))
      throw new Error('Only letters, numbers, spaces and underscores allowed');
    const available = await checkNameAvailableForUid(trimmed, state.userId);
    if (!available) throw new Error('That name is already taken');
    await updatePlayerNameInRoom(state.userId, state.roomId, trimmed);
    localStorage.setItem(STORAGE_KEY, trimmed);
    dispatch({ type: 'SET_PLAYER_NAME', name: trimmed });
  };

  const loginWithGoogle = async () => {
    dispatch({ type: 'SET_AUTH_LOADING', value: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      await signInWithGoogle();
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err.message || 'Sign-in failed' });
      dispatch({ type: 'SET_AUTH_LOADING', value: false });
    }
  };

  const loginAnonymously = async (customName) => {
    dispatch({ type: 'SET_AUTH_LOADING', value: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      if (customName) sessionStorage.setItem('pending_guest_name', customName.trim());
      const userCredential = await signInAnonymouslyUser();
      const uid = userCredential.user.uid;
      if (customName) {
        const uniqueName = await resolveUniqueName(uid, customName.trim());
        localStorage.setItem(STORAGE_KEY, uniqueName);
        sessionStorage.removeItem('pending_guest_name');
        await setUserOnline(uid, uniqueName);
        dispatch({ type: 'SET_LOGGED_IN', name: uniqueName });
      }
      dispatch({ type: 'SET_AUTH_LOADING', value: false });
    } catch (err) {
      sessionStorage.removeItem('pending_guest_name');
      dispatch({ type: 'SET_ERROR', error: err.message || 'Anonymous sign-in failed' });
      dispatch({ type: 'SET_AUTH_LOADING', value: false });
    }
  };

  const logout = async () => {
    if (state.userId) await removeUserOnline(state.userId).catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    await signOutUser();
    dispatch({ type: 'SET_LOADING', value: false });
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <GameContext.Provider value={{
      state, setRoomId, leaveRoom, setLoading, setError, notify,
      loginWithGoogle, loginAnonymously, logout, updateUsername,
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

// src/context/GameContext.js
import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { signInAnon, listenRoom, listenChat, setUserOnline, removeUserOnline } from '../firebase/services';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const GameContext = createContext(null);

const STORAGE_KEY = 'celebrations_player_name';

const initialState = {
  userId: null,
  isAuthReady: false,
  playerName: null,      // set after login
  isLoggedIn: false,     // true once name is confirmed
  roomId: null,
  room: null,
  me: null,
  isHost: false,
  isDrawer: false,
  chat: [],
  notification: null,
  isLoading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH':
      return { ...state, userId: action.userId, isAuthReady: true };
    case 'SET_LOGGED_IN':
      return { ...state, playerName: action.name, isLoggedIn: true };
    case 'LOGOUT':
      return { ...state, playerName: null, isLoggedIn: false, roomId: null, room: null };
    case 'SET_ROOM_ID':
      return { ...state, roomId: action.roomId };
    case 'SET_ROOM': {
      const me = action.room?.players?.[state.userId] || null;
      const isHost = action.room?.hostId === state.userId;
      const isDrawer = action.room?.currentDrawer === state.userId;
      return { ...state, room: action.room, me, isHost, isDrawer };
    }
    case 'SET_CHAT':      return { ...state, chat: action.chat };
    case 'SET_LOADING':   return { ...state, isLoading: action.value };
    case 'SET_ERROR':     return { ...state, error: action.error };
    case 'SET_NOTIFICATION': return { ...state, notification: action.notification };
    case 'LEAVE_ROOM':
      return { ...state, roomId: null, room: null, me: null, isHost: false, isDrawer: false, chat: [] };
    default: return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubRoomRef = useRef(null);
  const unsubChatRef = useRef(null);

  // Auth on mount
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        dispatch({ type: 'SET_AUTH', userId: user.uid });
        // Restore saved name — uniqueness will be validated by LoginScreen
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          // Re-register presence with saved name (LoginScreen will validate on next visit)
          // Optimistically restore so returning users don't hit login on every refresh
          try {
            await setUserOnline(user.uid, saved);
            dispatch({ type: 'SET_LOGGED_IN', name: saved });
          } catch {
            // ignore, LoginScreen will handle
          }
        }
      } else {
        await signInAnon();
      }
    });
    return unsub;
  }, []);

  // Room listener
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

  const loginWithName = async (name) => {
    if (!state.userId) throw new Error('Not authenticated yet');
    await setUserOnline(state.userId, name);
    localStorage.setItem(STORAGE_KEY, name);
    dispatch({ type: 'SET_LOGGED_IN', name });
  };

  const logout = async () => {
    if (state.userId) await removeUserOnline(state.userId);
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <GameContext.Provider value={{ state, setRoomId, leaveRoom, setLoading, setError, notify, loginWithName, logout }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGameContext = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext must be used within GameProvider');
  return ctx;
};

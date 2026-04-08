// src/hooks/useRoom.js
import { useCallback } from 'react';
import { useGameContext } from '../context/GameContext';
import { createRoom, joinRoom, leaveRoom as fbLeaveRoom, resetRoom } from '../firebase/services';

export function useRoom() {
  const { state, setRoomId, leaveRoom: ctxLeave, setLoading, setError, notify } = useGameContext();

  const create = useCallback(async (playerName, settings) => {
    setLoading(true);
    try {
      const roomId = await createRoom(playerName, settings);
      setRoomId(roomId);
      notify(`Room ${roomId} created!`);
      return roomId;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setRoomId, setLoading, setError, notify]);

  const join = useCallback(async (roomId, playerName) => {
    setLoading(true);
    try {
      await joinRoom(roomId.toUpperCase(), playerName);
      setRoomId(roomId.toUpperCase());
      notify(`Joined room ${roomId.toUpperCase()}!`);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setRoomId, setLoading, setError, notify]);

  const leave = useCallback(async () => {
    if (state.roomId && state.userId) {
      await fbLeaveRoom(state.roomId, state.userId);
    }
    ctxLeave();
  }, [state.roomId, state.userId, ctxLeave]);

  const reset = useCallback(async () => {
    if (!state.roomId || !state.isHost) return;
    await resetRoom(state.roomId, state.userId);
    notify('Game reset!');
  }, [state.roomId, state.userId, state.isHost, notify]);

  return { create, join, leave, reset };
}

// src/hooks/useGameSession.js
// Shared utilities: offline detection, session persistence for resume, confirm-leave modal
import { useState, useEffect, useCallback } from 'react';

const SESSION_KEY = 'game_session_v1';

// ── Persist/restore session ───────────────────────────────────────────────────
export function saveSession(roomId, userId, gameType) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, userId, gameType, ts: Date.now() })); } catch {}
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // Expire after 24 h
    if (Date.now() - s.ts > 86_400_000) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

// ── Online/offline hook ───────────────────────────────────────────────────────
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// ── Hook used inside every game component ────────────────────────────────────
export function useGameGuard({ roomId, userId, gameType, leaveCallback }) {
  const online = useOnline();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Save session whenever we're in a room
  useEffect(() => {
    if (roomId && userId) saveSession(roomId, userId, gameType);
  }, [roomId, userId, gameType]);

  const requestLeave = useCallback(() => setConfirmOpen(true), []);
  const cancelLeave = useCallback(() => setConfirmOpen(false), []);
  const confirmLeave = useCallback(async () => {
    clearSession();
    setConfirmOpen(false);
    await leaveCallback();
  }, [leaveCallback]);

  return { online, confirmOpen, requestLeave, cancelLeave, confirmLeave };
}
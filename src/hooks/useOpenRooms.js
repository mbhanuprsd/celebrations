// src/hooks/useOpenRooms.js
import { useState, useEffect } from 'react';
import { listenOpenRooms } from '../firebase/services';

export function useOpenRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = listenOpenRooms((openRooms) => {
      setRooms(openRooms);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { rooms, loading };
}

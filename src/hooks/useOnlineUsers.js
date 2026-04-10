import { useState, useEffect } from 'react';
import { listenOnlineUsers } from '../firebase/services';

export function useOnlineUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = listenOnlineUsers(setUsers);
    return unsub;
  }, []);

  return { users, count: users.length };
}

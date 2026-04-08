// src/firebase/index.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import firebaseConfig from './config';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export default app;

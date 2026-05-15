import { initializeApp, getApp } from "firebase/app";
import { initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
// No persistence — session lives in memory only, cleared on every refresh/new tab
export const auth = initializeAuth(app, { persistence: inMemoryPersistence });
export const db = getFirestore(app);

// Purge ALL stale Firebase auth sessions from localStorage (old code used local persistence)
try {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('firebase:')) localStorage.removeItem(key);
  });
} catch {}

// Secondary app — persistence is set to inMemoryPersistence at init time
// so it NEVER reads from or writes to localStorage/IndexedDB.
let _secondaryApp;
try { _secondaryApp = getApp('secondary'); } catch { _secondaryApp = initializeApp(firebaseConfig, 'secondary'); }
export const secondaryAuth = initializeAuth(_secondaryApp, { persistence: inMemoryPersistence });


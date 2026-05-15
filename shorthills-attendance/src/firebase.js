import { initializeApp, getApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence } from "firebase/auth";
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
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary app — creates employee accounts without signing out the admin.
// Uses in-memory persistence so it never saves anything to localStorage.
let _secondaryApp;
try { _secondaryApp = getApp('secondary'); } catch { _secondaryApp = initializeApp(firebaseConfig, 'secondary'); }
export const secondaryAuth = getAuth(_secondaryApp);
setPersistence(secondaryAuth, inMemoryPersistence);

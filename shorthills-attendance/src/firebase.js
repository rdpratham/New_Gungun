import { initializeApp, getApp, getApps } from "firebase/app";
import { initializeAuth, inMemoryPersistence, browserSessionPersistence } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Guard: if env vars are missing (e.g. Render build without env vars set),
// log a clear error instead of crashing silently with an opaque Firebase exception.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    '[firebase.js] Firebase env vars are missing. ' +
    'Make sure VITE_FIREBASE_* variables are set in your Render environment settings.'
  );
}

// Reuse existing app if hot-reloading in dev (avoids "duplicate app" error)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export { app };

// Session persistence — survives refresh in same tab, clears on tab close or new tab
export const auth = initializeAuth(app, { persistence: browserSessionPersistence });

// Memory-only cache: no IndexedDB, no stale data, always fetches fresh from server
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  ignoreUndefinedProperties: true,
});

// Purge stale Firebase auth sessions from localStorage (legacy local-persistence keys)
try {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('firebase:')) localStorage.removeItem(key);
  });
} catch {}

// Secondary Firebase app for creating employee accounts without signing out admin
let _secondaryApp;
try {
  _secondaryApp = getApp('secondary');
} catch {
  _secondaryApp = initializeApp(firebaseConfig, 'secondary');
}
export const secondaryAuth = initializeAuth(_secondaryApp, { persistence: inMemoryPersistence });

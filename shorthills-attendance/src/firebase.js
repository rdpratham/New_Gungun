import { initializeApp, getApp, getApps } from "firebase/app";
import { initializeAuth, getAuth, inMemoryPersistence, browserSessionPersistence } from "firebase/auth";
import { initializeFirestore, getFirestore, memoryLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    '[firebase.js] Firebase env vars are missing. ' +
    'Make sure VITE_FIREBASE_* variables are set in your Render environment settings.'
  );
}

// Reuse existing app if hot-reloading (avoids "duplicate app" error)
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export { app };

// Guard initializeAuth — calling it twice on the same app throws a fatal error
function getOrInitAuth(appInstance, opts) {
  try {
    return initializeAuth(appInstance, opts);
  } catch {
    // Already initialized — return existing instance
    return getAuth(appInstance);
  }
}

export const auth = getOrInitAuth(app, { persistence: browserSessionPersistence });

// Guard initializeFirestore similarly
function getOrInitFirestore(appInstance, opts) {
  try {
    return initializeFirestore(appInstance, opts);
  } catch {
    return getFirestore(appInstance);
  }
}

export const db = getOrInitFirestore(app, {
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
export const secondaryAuth = getOrInitAuth(_secondaryApp, { persistence: inMemoryPersistence });

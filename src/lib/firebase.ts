import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)?.trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined)?.trim(),
};

function ensureFirebaseConfig() {
  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error(
      "Configuration Firebase incomplete. Renseignez VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID et VITE_FIREBASE_APP_ID."
    );
  }
}

let firebaseAuthInstance: ReturnType<typeof getAuth> | null = null;
let firebaseDbInstance: ReturnType<typeof getFirestore> | null = null;
let firebaseAppInstance: ReturnType<typeof initializeApp> | null = null;

function getFirebaseApp() {
  if (firebaseAppInstance) return firebaseAppInstance;
  ensureFirebaseConfig();
  firebaseAppInstance = initializeApp(firebaseConfig);
  return firebaseAppInstance;
}

export function getFirebaseAuth() {
  if (firebaseAuthInstance) return firebaseAuthInstance;
  const app = getFirebaseApp();
  firebaseAuthInstance = getAuth(app);
  return firebaseAuthInstance;
}

export function getFirebaseDb() {
  if (firebaseDbInstance) return firebaseDbInstance;
  const app = getFirebaseApp();
  firebaseDbInstance = getFirestore(app);
  return firebaseDbInstance;
}

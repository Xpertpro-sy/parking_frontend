import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

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

export function getFirebaseAuth() {
  if (firebaseAuthInstance) return firebaseAuthInstance;
  ensureFirebaseConfig();
  const app = initializeApp(firebaseConfig);
  firebaseAuthInstance = getAuth(app);
  return firebaseAuthInstance;
}

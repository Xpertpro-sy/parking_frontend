import {
  createUserWithEmailAndPassword,
  getIdToken,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import type { AuthApiResponse, LoginPayload, RegisterPayload } from "@/lib/auth-api";

function parseFirebaseAuthError(error: unknown): string {
  if (!(error instanceof Error)) return "Erreur Firebase. Veuillez reessayer.";
  const message = error.message.toLowerCase();
  if (message.includes("auth/email-already-in-use")) return "Cet email est deja utilise.";
  if (message.includes("auth/invalid-email")) return "Adresse email invalide.";
  if (message.includes("auth/weak-password")) return "Mot de passe trop faible (min 6 caracteres).";
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password") || message.includes("auth/user-not-found")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("configuration firebase incomplete")) return error.message;
  return "Erreur Firebase. Veuillez reessayer.";
}

function splitDisplayName(displayName: string | null, email: string): { prenom: string; nom: string } {
  if (!displayName || !displayName.trim()) {
    return { prenom: "Utilisateur", nom: email.split("@")[0] || "Firebase" };
  }
  const parts = displayName.trim().split(/\s+/);
  const prenom = parts[0] || "Utilisateur";
  const nom = parts.slice(1).join(" ") || "Firebase";
  return { prenom, nom };
}

export async function registerWithFirebase(payload: RegisterPayload): Promise<AuthApiResponse> {
  try {
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    await updateProfile(credential.user, { displayName: `${payload.prenom} ${payload.nom}`.trim() });
    const token = await getIdToken(credential.user, true);
    return {
      message: "Compte cree avec succes.",
      accessToken: token,
      userId: 0,
      nom: payload.nom,
      prenom: payload.prenom,
      email: credential.user.email ?? payload.email,
      role: "USER",
    };
  } catch (error) {
    throw new Error(parseFirebaseAuthError(error));
  }
}

export async function loginWithFirebase(payload: LoginPayload): Promise<AuthApiResponse> {
  try {
    const auth = getFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, payload.email, payload.password);
    const token = await getIdToken(credential.user, true);
    const parsedName = splitDisplayName(credential.user.displayName, credential.user.email ?? payload.email);
    return {
      message: "Connexion reussie (Firebase).",
      accessToken: token,
      userId: 0,
      nom: parsedName.nom,
      prenom: parsedName.prenom,
      email: credential.user.email ?? payload.email,
      role: "USER",
    };
  } catch (error) {
    throw new Error(parseFirebaseAuthError(error));
  }
}

export async function logoutFirebase(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    await signOut(auth);
  } catch {
    // Ignore Firebase sign-out errors and keep local logout flow.
  }
}

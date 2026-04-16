import {
  createUserWithEmailAndPassword,
  getIdToken,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
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
  if (message.includes("permission-denied")) return "Acces Firestore refuse. Verifiez vos regles Firestore.";
  if (message.includes("unavailable")) return "Service Firebase indisponible temporairement.";
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

async function upsertUserFirestore(params: {
  uid: string;
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  includeCreatedAt?: boolean;
}) {
  const db = getFirebaseDb();
  const payload: Record<string, unknown> = {
    uid: params.uid,
    email: params.email,
    prenom: params.prenom,
    nom: params.nom,
    displayName: `${params.prenom} ${params.nom}`.trim(),
    telephone: params.telephone ?? null,
    role: "ADMIN",
    updatedAt: serverTimestamp(),
  };
  if (params.includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(
    doc(db, "users", params.uid),
    payload,
    { merge: true }
  );
}

export async function registerWithFirebase(payload: RegisterPayload): Promise<AuthApiResponse> {
  try {
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    await updateProfile(credential.user, { displayName: `${payload.prenom} ${payload.nom}`.trim() });
    try {
      await upsertUserFirestore({
        uid: credential.user.uid,
        email: credential.user.email ?? payload.email,
        prenom: payload.prenom,
        nom: payload.nom,
        telephone: payload.telephone,
        includeCreatedAt: true,
      });
    } catch (firestoreError) {
      console.error("Firestore sync failed after register:", firestoreError);
    }
    const token = await getIdToken(credential.user, true);
    return {
      message: "Compte cree avec succes.",
      accessToken: token,
      userId: 0,
      nom: payload.nom,
      prenom: payload.prenom,
      email: credential.user.email ?? payload.email,
      role: "ADMIN",
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
    try {
      await upsertUserFirestore({
        uid: credential.user.uid,
        email: credential.user.email ?? payload.email,
        prenom: parsedName.prenom,
        nom: parsedName.nom,
      });
    } catch (firestoreError) {
      console.error("Firestore sync failed after login:", firestoreError);
    }
    return {
      message: "Connexion reussie.",
      accessToken: token,
      userId: 0,
      nom: parsedName.nom,
      prenom: parsedName.prenom,
      email: credential.user.email ?? payload.email,
      role: "ADMIN",
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

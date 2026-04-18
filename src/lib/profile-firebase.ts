import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, waitForFirebaseUser } from "@/lib/firebase";

export type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleLabel: string;
};

function parseProfileError(error: unknown): string {
  if (!(error instanceof Error)) return "Une erreur est survenue.";
  const m = error.message.toLowerCase();
  if (m.includes("auth/wrong-password") || m.includes("auth/invalid-credential")) {
    return "Mot de passe actuel incorrect.";
  }
  if (m.includes("auth/weak-password")) {
    return "Le nouveau mot de passe est trop faible (minimum 6 caractères Firebase).";
  }
  if (m.includes("auth/requires-recent-login")) {
    return "Pour des raisons de sécurité, déconnectez-vous puis reconnectez-vous avant de changer le mot de passe.";
  }
  if (m.includes("auth/too-many-requests")) {
    return "Trop de tentatives. Réessayez plus tard.";
  }
  return error.message;
}

export async function fetchUserProfileFirebase(): Promise<UserProfile> {
  const authUser = await waitForFirebaseUser();
  if (!authUser?.uid) {
    throw new Error("Session Firebase invalide. Veuillez vous reconnecter.");
  }
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "users", authUser.uid));
  const data = snap.exists() ? (snap.data() as { prenom?: string; nom?: string; telephone?: string | null; role?: string }) : {};

  const firstName = (data.prenom ?? "").trim() || "Utilisateur";
  const lastName = (data.nom ?? "").trim() || "";
  const email = (authUser.email ?? "").trim();
  const phone = (data.telephone ?? "").trim();
  const role = (data.role ?? "").toUpperCase() === "GESTIONNAIRE" ? "Gestionnaire" : "Administrateur";

  return {
    firstName,
    lastName,
    email,
    phone,
    roleLabel: role,
  };
}

export async function updateUserProfileFirebase(payload: {
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<void> {
  const auth = getFirebaseAuth();
  const authUser = auth.currentUser ?? (await waitForFirebaseUser());
  if (!authUser?.uid) {
    throw new Error("Session Firebase invalide.");
  }

  const displayName = `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim();
  await updateProfile(authUser, { displayName });

  const db = getFirebaseDb();
  await setDoc(
    doc(db, "users", authUser.uid),
    {
      prenom: payload.firstName.trim(),
      nom: payload.lastName.trim(),
      displayName,
      telephone: payload.phone.trim() || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function changePasswordFirebase(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const auth = getFirebaseAuth();
  const authUser = auth.currentUser ?? (await waitForFirebaseUser());
  if (!authUser?.email) {
    throw new Error("Impossible de vérifier votre compte.");
  }
  const email = authUser.email;
  const credential = EmailAuthProvider.credential(email, payload.currentPassword);
  await reauthenticateWithCredential(authUser, credential);
  await updatePassword(authUser, payload.newPassword);
}

export { parseProfileError };

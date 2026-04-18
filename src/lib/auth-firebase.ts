import {
  createUserWithEmailAndPassword,
  getIdToken,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import type { AuthApiResponse, LoginPayload, RegisterPayload } from "@/lib/auth-api";
import { DEFAULT_ADMIN_PERMISSIONS, DEFAULT_MANAGER_PERMISSIONS, PermissionMap } from "@/lib/access-control";
import { SUPER_ADMIN_DEFAULT_EMAIL } from "@/lib/super-admin";
import { TRIAL_SUBSCRIPTION_PLAN_ID, getTrialExpiresAt } from "@/lib/subscription-plans";

/** Même logique que dans manager-access-api (évite une dépendance circulaire auth-firebase → manager-access-api). */
function normalizeManagerPermissionsFromAccess(input?: Partial<PermissionMap>): PermissionMap {
  return {
    ...DEFAULT_MANAGER_PERMISSIONS,
    ...(input ?? {}),
    accounts: false,
    settings: false,
    trash: Boolean((input ?? {}).trash),
  };
}

function parseFirebaseAuthError(error: unknown): string {
  if (error instanceof Error) {
    const m = error.message;
    if (
      m.startsWith("Votre compte a été désactivé") ||
      m.startsWith("Votre compte a été supprimé") ||
      m.startsWith("Compte sans adresse")
    ) {
      return m;
    }
  }
  if (!(error instanceof Error)) return "Erreur Firebase. Veuillez reessayer.";
  const message = error.message.toLowerCase();
  if (message.includes("auth/email-already-in-use")) return "Cet email est deja utilise.";
  if (message.includes("auth/invalid-email")) return "Adresse email invalide.";
  if (message.includes("auth/weak-password")) return "Mot de passe trop faible (min 6 caracteres).";
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password") || message.includes("auth/user-not-found")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("permission-denied") || message.includes("insufficient permissions")) {
    return "Acces Firestore refuse. Verifiez vos regles Firestore.";
  }
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
  const existingSnap = await getDoc(doc(db, "users", params.uid));
  const existingData = existingSnap.exists() ? (existingSnap.data() as { role?: string; permissions?: Partial<PermissionMap>; enterpriseOwnerUid?: string }) : null;
  const existingRole = existingData?.role?.toUpperCase();
  const role =
    existingRole === "GESTIONNAIRE" ? "GESTIONNAIRE" : existingRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
  const permissions =
    role === "GESTIONNAIRE"
      ? { ...DEFAULT_MANAGER_PERMISSIONS, ...(existingData?.permissions ?? {}) }
      : role === "SUPER_ADMIN"
        ? { ...DEFAULT_ADMIN_PERMISSIONS, ...(existingData?.permissions ?? {}) }
        : DEFAULT_ADMIN_PERMISSIONS;
  const payload: Record<string, unknown> = {
    uid: params.uid,
    email: params.email,
    prenom: params.prenom,
    nom: params.nom,
    displayName: `${params.prenom} ${params.nom}`.trim(),
    role,
    permissions,
    enterpriseOwnerUid: role === "GESTIONNAIRE" ? existingData?.enterpriseOwnerUid ?? params.uid : params.uid,
    updatedAt: serverTimestamp(),
  };
  // Ne pas écrire `telephone` si absent : sinon à chaque login on fusionnait `null` et effaçait le numéro du profil.
  if (params.telephone !== undefined) {
    payload.telephone = params.telephone.trim() === "" ? null : params.telephone.trim();
  }
  if (params.includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(
    doc(db, "users", params.uid),
    payload,
    { merge: true }
  );
}

/** Essai gratuit 1 mois : une seule création, si aucune fiche `tenantSubscriptions` encore. */
async function ensureTrialSubscriptionForNewTenantAdmin(adminUid: string) {
  const db = getFirebaseDb();
  const subRef = doc(db, "tenantSubscriptions", adminUid);
  const existing = await getDoc(subRef);
  if (existing.exists()) return;
  const expiresAt = getTrialExpiresAt(new Date());
  await setDoc(subRef, {
    ownerUid: adminUid,
    planId: TRIAL_SUBSCRIPTION_PLAN_ID,
    expiresAt: Timestamp.fromDate(expiresAt),
    updatedAt: serverTimestamp(),
    lastApprovedRequestId: null,
  });
}

type ManagerAccessRow = {
  status: string;
  ownerUid: string;
  managerUid?: string | null;
  permissions?: Partial<PermissionMap>;
};

/**
 * Après Authentication : aligne Firestore, refuse les gestionnaires désactivés / révoqués.
 */
async function postAuthFirestoreSync(
  auth: Auth,
  user: User,
  prenom: string,
  nom: string,
  options?: { includeCreatedAtForNewUser?: boolean; telephone?: string },
): Promise<"ADMIN" | "GESTIONNAIRE" | "SUPER_ADMIN"> {
  const db = getFirebaseDb();
  const emailNormalized = (user.email ?? "").trim().toLowerCase();
  if (!emailNormalized) {
    await signOut(auth);
    throw new Error("Compte sans adresse e-mail : connexion impossible.");
  }

  const uid = user.uid;
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.exists() ? (userSnap.data() as { role?: string; managerStatus?: string }) : null;

  if (userData?.role?.toUpperCase() === "SUPER_ADMIN") {
    return "SUPER_ADMIN";
  }

  if (userData?.role?.toUpperCase() === "GESTIONNAIRE" && userData?.managerStatus === "inactive") {
    await signOut(auth);
    throw new Error(
      "Votre compte a été désactivé par un administrateur. Contactez-le si vous avez besoin d'y accéder à nouveau.",
    );
  }

  const accessSnapshot = await getDocs(
    query(collection(db, "managerAccess"), where("managerEmailNormalized", "==", emailNormalized)),
  );

  const matchedDoc = accessSnapshot.docs.find((d) => {
    const row = d.data() as ManagerAccessRow;
    return row.managerUid === uid;
  });

  if (matchedDoc) {
    const access = matchedDoc.data() as ManagerAccessRow;
    if (access.status === "inactive") {
      await signOut(auth);
      throw new Error(
        "Votre compte a été désactivé par un administrateur. Contactez-le si vous avez besoin d'y accéder à nouveau.",
      );
    }

    const displayName = `${prenom} ${nom}`.trim();
    const payload: Record<string, unknown> = {
      uid,
      email: user.email ?? emailNormalized,
      prenom,
      nom,
      displayName,
      role: "GESTIONNAIRE",
      enterpriseOwnerUid: access.ownerUid,
      permissions: normalizeManagerPermissionsFromAccess(access.permissions),
      managerAccessId: matchedDoc.id,
      managerStatus: "active",
      updatedAt: serverTimestamp(),
    };
    if (options?.includeCreatedAtForNewUser && !userSnap.exists()) {
      payload.createdAt = serverTimestamp();
    }
    await setDoc(doc(db, "users", uid), payload, { merge: true });
    return "GESTIONNAIRE";
  }

  if (userData?.role?.toUpperCase() === "GESTIONNAIRE" || userData?.managerStatus === "removed") {
    await signOut(auth);
    throw new Error(
      "Votre compte a été supprimé par un administrateur. Contactez-le si vous pensez qu'il s'agit d'une erreur.",
    );
  }

  const isNewProfile = !userSnap.exists();
  await upsertUserFirestore({
    uid,
    email: user.email ?? emailNormalized,
    prenom,
    nom,
    telephone: options?.telephone,
    includeCreatedAt: Boolean(options?.includeCreatedAtForNewUser && isNewProfile),
  });
  if (options?.includeCreatedAtForNewUser && isNewProfile) {
    try {
      await ensureTrialSubscriptionForNewTenantAdmin(uid);
    } catch (e) {
      console.warn("Essai gratuit non enregistré (Firestore) :", e);
    }
  }
  return "ADMIN";
}

export async function registerWithFirebase(payload: RegisterPayload): Promise<AuthApiResponse> {
  try {
    if (payload.email.trim().toLowerCase() === SUPER_ADMIN_DEFAULT_EMAIL) {
      throw new Error("Cette adresse e-mail est reservee au compte super administrateur.");
    }
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    await updateProfile(credential.user, { displayName: `${payload.prenom} ${payload.nom}`.trim() });
    const role = await postAuthFirestoreSync(auth, credential.user, payload.prenom, payload.nom, {
      includeCreatedAtForNewUser: true,
      telephone: payload.telephone,
    });
    const token = await getIdToken(credential.user, true);
    return {
      message: "Compte cree avec succes.",
      accessToken: token,
      userId: 0,
      nom: payload.nom,
      prenom: payload.prenom,
      email: credential.user.email ?? payload.email,
      role,
    };
  } catch (error) {
    throw new Error(parseFirebaseAuthError(error));
  }
}

export async function loginWithFirebase(payload: LoginPayload): Promise<AuthApiResponse> {
  try {
    const auth = getFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, payload.email, payload.password);
    const parsedName = splitDisplayName(credential.user.displayName, credential.user.email ?? payload.email);
    const role = await postAuthFirestoreSync(auth, credential.user, parsedName.prenom, parsedName.nom);
    const token = await getIdToken(credential.user, true);
    return {
      message: "Connexion reussie.",
      accessToken: token,
      userId: 0,
      nom: parsedName.nom,
      prenom: parsedName.prenom,
      email: credential.user.email ?? payload.email,
      role,
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

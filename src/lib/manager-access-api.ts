import { AppPermission, DEFAULT_MANAGER_PERMISSIONS, PermissionMap, getWorkspaceIdentity } from "@/lib/access-control";
import { getFirebaseDb, getSecondaryFirebaseAuth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";

/** Mot de passe initial attribué à chaque gestionnaire créé depuis l’app (connexion Firebase Auth). */
export const MANAGER_DEFAULT_INITIAL_PASSWORD = "11223344";

function mapManagerAuthError(error: unknown): string {
  if (!(error instanceof Error)) return "Impossible de créer le compte Firebase Authentication.";
  const message = error.message.toLowerCase();
  if (message.includes("auth/email-already-in-use")) {
    return "Cet email possède déjà un compte dans Authentication. Utilisez une autre adresse ou supprimez l’ancien compte dans la console Firebase.";
  }
  if (message.includes("auth/invalid-email")) return "Adresse email invalide.";
  if (message.includes("auth/weak-password")) return "Mot de passe refusé par Firebase (règles de sécurité du projet).";
  if (message.includes("auth/operation-not-allowed")) {
    return "La création de compte e-mail / mot de passe est désactivée dans la console Firebase.";
  }
  return "Impossible de créer le compte Firebase Authentication.";
}

function splitManagerDisplayName(displayName: string, email: string): { prenom: string; nom: string } {
  const trimmed = displayName.trim();
  if (!trimmed) {
    const local = email.split("@")[0] || "Gestionnaire";
    return { prenom: "Gestionnaire", nom: local };
  }
  const parts = trimmed.split(/\s+/);
  const prenom = parts[0] || "Gestionnaire";
  const nom = parts.slice(1).join(" ") || prenom;
  return { prenom, nom };
}

export type ManagerAccessStatus = "active" | "inactive";

type ManagerAccessDoc = {
  ownerUid: string;
  ownerEmail: string | null;
  managerUid: string | null;
  managerName: string;
  managerEmail: string;
  managerEmailNormalized: string;
  role: "GESTIONNAIRE";
  status: ManagerAccessStatus;
  permissions: PermissionMap;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ManagerAccessItem = {
  id: string;
  managerUid: string | null;
  managerName: string;
  managerEmail: string;
  status: ManagerAccessStatus;
  permissions: PermissionMap;
  createdAt: string;
};

export type CreateManagerPayload = {
  managerName: string;
  managerEmail: string;
  permissions: PermissionMap;
};

export const managerAccessQueryKey = ["manager-access", "list"] as const;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Profil Firestore après suppression du lien managerAccess (bloque la connexion côté appli). */
export const REVOKED_MANAGER_PROFILE_PERMISSIONS: PermissionMap = {
  dashboard: false,
  vehicles: false,
  receipts: false,
  comptability: false,
  rentals: false,
  reservations: false,
  history: false,
  trash: false,
  settings: false,
  accounts: false,
};

export function normalizePermissions(input?: Partial<PermissionMap>): PermissionMap {
  return {
    ...DEFAULT_MANAGER_PERMISSIONS,
    ...(input ?? {}),
    accounts: false,
    settings: false,
    trash: Boolean((input ?? {}).trash),
  };
}

async function ensureAdminWorkspace() {
  const identity = await getWorkspaceIdentity();
  if (identity.role !== "ADMIN") {
    throw new Error("Acces reserve aux administrateurs.");
  }
  return identity;
}

function mapManagerDoc(id: string, data: ManagerAccessDoc): ManagerAccessItem {
  return {
    id,
    managerUid: data.managerUid ?? null,
    managerName: data.managerName,
    managerEmail: data.managerEmail,
    status: data.status,
    permissions: normalizePermissions(data.permissions),
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
  };
}

async function syncManagerUserDoc(params: {
  managerUid: string | null;
  ownerUid: string;
  permissions: PermissionMap;
  status: ManagerAccessStatus;
}) {
  if (!params.managerUid) return;
  const db = getFirebaseDb();
  await setDoc(
    doc(db, "users", params.managerUid),
    {
      role: "GESTIONNAIRE",
      enterpriseOwnerUid: params.ownerUid,
      permissions: params.permissions,
      managerStatus: params.status,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function listManagerAccessRequest(): Promise<ManagerAccessItem[]> {
  const db = getFirebaseDb();
  const identity = await ensureAdminWorkspace();
  const snapshot = await getDocs(
    query(collection(db, "managerAccess"), where("ownerUid", "==", identity.uid)),
  );
  return snapshot.docs
    .map((docSnap) => mapManagerDoc(docSnap.id, docSnap.data() as ManagerAccessDoc))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createManagerAccessRequest(payload: CreateManagerPayload): Promise<void> {
  const db = getFirebaseDb();
  const identity = await ensureAdminWorkspace();
  const managerEmailNormalized = normalizeEmail(payload.managerEmail);
  if (!managerEmailNormalized.includes("@")) {
    throw new Error("Email gestionnaire invalide.");
  }
  const permissions = normalizePermissions(payload.permissions);

  const existing = await getDocs(
    query(
      collection(db, "managerAccess"),
      where("ownerUid", "==", identity.uid),
      where("managerEmailNormalized", "==", managerEmailNormalized),
    ),
  );
  if (!existing.empty) {
    throw new Error("Un gestionnaire avec cet email existe deja.");
  }

  const secondaryAuth = getSecondaryFirebaseAuth();
  let managerUid: string;
  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      managerEmailNormalized,
      MANAGER_DEFAULT_INITIAL_PASSWORD,
    );
    managerUid = credential.user.uid;
    await updateProfile(credential.user, { displayName: payload.managerName.trim() });
  } catch (error) {
    throw new Error(mapManagerAuthError(error));
  } finally {
    await signOut(secondaryAuth);
  }

  const trimmedName = payload.managerName.trim();
  const { prenom, nom } = splitManagerDisplayName(trimmedName, managerEmailNormalized);
  const accessRef = doc(collection(db, "managerAccess"));

  await setDoc(accessRef, {
    ownerUid: identity.uid,
    ownerEmail: identity.email,
    managerUid,
    managerName: trimmedName,
    managerEmail: managerEmailNormalized,
    managerEmailNormalized,
    role: "GESTIONNAIRE",
    status: "active",
    permissions,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Omit<ManagerAccessDoc, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  });

  await setDoc(
    doc(db, "users", managerUid),
    {
      uid: managerUid,
      email: managerEmailNormalized,
      prenom,
      nom,
      displayName: trimmedName,
      role: "GESTIONNAIRE",
      enterpriseOwnerUid: identity.uid,
      permissions,
      managerStatus: "active",
      managerAccessId: accessRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateManagerAccessPermissionsRequest(managerAccessId: string, permissions: Partial<PermissionMap>) {
  const db = getFirebaseDb();
  const identity = await ensureAdminWorkspace();
  const ref = doc(db, "managerAccess", managerAccessId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Gestionnaire introuvable.");

  const data = snap.data() as ManagerAccessDoc;
  if (data.ownerUid !== identity.uid) throw new Error("Acces refuse.");

  const nextPermissions = normalizePermissions({ ...data.permissions, ...permissions });
  await updateDoc(ref, {
    permissions: nextPermissions,
    updatedAt: serverTimestamp(),
  });
  await syncManagerUserDoc({
    managerUid: data.managerUid ?? null,
    ownerUid: identity.uid,
    permissions: nextPermissions,
    status: data.status,
  });
}

export async function updateManagerAccessStatusRequest(managerAccessId: string, status: ManagerAccessStatus) {
  const db = getFirebaseDb();
  const identity = await ensureAdminWorkspace();
  const ref = doc(db, "managerAccess", managerAccessId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Gestionnaire introuvable.");

  const data = snap.data() as ManagerAccessDoc;
  if (data.ownerUid !== identity.uid) throw new Error("Acces refuse.");

  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp(),
  });
  await syncManagerUserDoc({
    managerUid: data.managerUid ?? null,
    ownerUid: identity.uid,
    permissions: normalizePermissions(data.permissions),
    status,
  });
}

/**
 * Supprime l’accès Firestore du gestionnaire et le document managerAccess.
 * Le compte Firebase Authentication peut rester : la connexion est bloquée via users.managerStatus.
 * Pour libérer l’e-mail, supprimez aussi l’utilisateur dans la console Firebase Authentication si besoin.
 */
export async function deleteManagerAccessRequest(managerAccessId: string): Promise<void> {
  const db = getFirebaseDb();
  const identity = await ensureAdminWorkspace();
  const ref = doc(db, "managerAccess", managerAccessId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Gestionnaire introuvable.");

  const data = snap.data() as ManagerAccessDoc;
  if (data.ownerUid !== identity.uid) throw new Error("Acces refuse.");

  if (data.managerUid) {
    await setDoc(
      doc(db, "users", data.managerUid),
      {
        uid: data.managerUid,
        email: data.managerEmailNormalized,
        role: "GESTIONNAIRE",
        enterpriseOwnerUid: identity.uid,
        managerStatus: "removed",
        managerAccessId: null,
        permissions: REVOKED_MANAGER_PROFILE_PERMISSIONS,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  await deleteDoc(ref);
}

export const MANAGER_PERMISSION_LABELS: Record<AppPermission, string> = {
  dashboard: "Tableau de bord",
  vehicles: "Véhicules",
  receipts: "Reçus",
  comptability: "Comptabilité",
  rentals: "Voitures louées",
  reservations: "Voitures réservées",
  history: "Historique",
  trash: "Corbeille",
  settings: "Paramètres",
  accounts: "Comptes",
};


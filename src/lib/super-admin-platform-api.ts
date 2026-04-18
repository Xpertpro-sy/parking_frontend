import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getWorkspaceIdentity } from "@/lib/access-control";
import {
  TENANT_ADMIN_LIMITS_COLLECTION,
  getTenantAdminMaxManagersAllowedFromServer,
} from "@/lib/tenant-admin-manager-limit";
import {
  buildSubscriptionDaySummary,
  getTenantSubscriptionStateRequest,
  hasPendingSubscriptionRequestSuperAdminRequest,
  type SubscriptionDaySummary,
  type TenantSubscriptionState,
} from "@/lib/subscription-api";

export type PlatformTenantAdminRow = {
  uid: string;
  email: string;
  displayName: string;
  prenom: string;
  nom: string;
  telephone: string;
  createdAtLabel: string | null;
};

export type SuperAdminPlatformStats = {
  managerCount: number;
  superAdminCount: number;
};

export const superAdminPlatformStatsQueryKey = ["super-admin", "platform-stats"] as const;
export const superAdminTenantAdminsQueryKey = ["super-admin", "tenant-admins"] as const;

export const superAdminTenantAdminDetailQueryKey = (adminUid: string) =>
  ["super-admin", "tenant-admin-detail", adminUid] as const;

export type TenantAdminDetailForSuperAdmin = {
  adminUid: string;
  email: string;
  displayName: string;
  prenom: string;
  nom: string;
  telephone: string;
  createdAtLabel: string | null;
  vehicleCount: number;
  managerAccessCount: number;
  maxManagers: number;
  subscriptionState: TenantSubscriptionState;
  subscriptionDaySummary: SubscriptionDaySummary;
};

function assertSuperAdminRole(role: string | undefined) {
  if (role !== "SUPER_ADMIN") {
    throw new Error("Accès réservé au super administrateur.");
  }
}

function formatFirestoreDate(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    try {
      return (value as Timestamp).toDate().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }
  return null;
}

type UserDocFields = {
  role?: string;
  email?: string;
  prenom?: string;
  nom?: string;
  displayName?: string;
  telephone?: string | null;
  createdAt?: unknown;
};

function parseUserCreatedAtDate(data: UserDocFields): Date | null {
  const raw = data.createdAt;
  if (raw != null && typeof raw === "object" && "toDate" in raw && typeof (raw as Timestamp).toDate === "function") {
    try {
      return (raw as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function mapUserDoc(docId: string, data: UserDocFields): PlatformTenantAdminRow {
  const prenom = (data.prenom ?? "").trim();
  const nom = (data.nom ?? "").trim();
  const displayName =
    (data.displayName ?? "").trim() ||
    `${prenom} ${nom}`.trim() ||
    (data.email ?? "").trim() ||
    docId;
  return {
    uid: docId,
    email: (data.email ?? "").trim(),
    displayName,
    prenom,
    nom,
    telephone: (data.telephone ?? "").trim(),
    createdAtLabel: formatFirestoreDate(data.createdAt),
  };
}

/** Administrateurs locataires inscrits sur la plateforme (rôle ADMIN dans `users`). */
export async function listPlatformTenantAdminsRequest(): Promise<PlatformTenantAdminRow[]> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, "users"), where("role", "==", "ADMIN")));
  return snapshot.docs
    .map((d) => mapUserDoc(d.id, d.data() as UserDocFields))
    .sort((a, b) => a.email.localeCompare(b.email, "fr", { sensitivity: "base" }));
}

export async function getSuperAdminPlatformStatsRequest(): Promise<SuperAdminPlatformStats> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  const [managers, superAdmins] = await Promise.all([
    getDocs(query(collection(db, "users"), where("role", "==", "GESTIONNAIRE"))),
    getDocs(query(collection(db, "users"), where("role", "==", "SUPER_ADMIN"))),
  ]);
  return {
    managerCount: managers.size,
    superAdminCount: superAdmins.size,
  };
}

export async function getTenantAdminDetailForSuperAdminRequest(
  adminUid: string,
): Promise<TenantAdminDetailForSuperAdmin> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  const userSnap = await getDoc(doc(db, "users", adminUid));
  if (!userSnap.exists()) {
    throw new Error("Administrateur introuvable.");
  }
  const data = userSnap.data() as UserDocFields;
  if ((data.role ?? "").toUpperCase() !== "ADMIN") {
    throw new Error("Ce compte n'est pas un administrateur locataire.");
  }
  const accountCreatedAt = parseUserCreatedAtDate(data);
  const [vehiclesSnap, managersSnap, maxManagers, subscriptionState, hasPendingSub] = await Promise.all([
    getDocs(query(collection(db, "vehicles"), where("ownerUid", "==", adminUid))),
    getDocs(query(collection(db, "managerAccess"), where("ownerUid", "==", adminUid))),
    getTenantAdminMaxManagersAllowedFromServer(adminUid),
    getTenantSubscriptionStateRequest(adminUid),
    hasPendingSubscriptionRequestSuperAdminRequest(adminUid),
  ]);
  const row = mapUserDoc(adminUid, data);
  const subscriptionDaySummary = buildSubscriptionDaySummary(
    subscriptionState,
    accountCreatedAt,
    hasPendingSub,
  );
  return {
    adminUid,
    email: row.email,
    displayName: row.displayName,
    prenom: row.prenom,
    nom: row.nom,
    telephone: row.telephone,
    createdAtLabel: row.createdAtLabel,
    vehicleCount: vehiclesSnap.size,
    managerAccessCount: managersSnap.size,
    maxManagers,
    subscriptionState,
    subscriptionDaySummary,
  };
}

export async function setTenantAdminMaxManagersSuperAdminRequest(
  adminUid: string,
  maxManagers: number,
): Promise<void> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  if (!Number.isFinite(maxManagers) || maxManagers < 0 || maxManagers > 500) {
    throw new Error("Plafond invalide (entre 0 et 500).");
  }
  const db = getFirebaseDb();
  const userSnap = await getDoc(doc(db, "users", adminUid));
  if (!userSnap.exists()) {
    throw new Error("Administrateur introuvable.");
  }
  const role = ((userSnap.data() as UserDocFields).role ?? "").toUpperCase();
  if (role !== "ADMIN") {
    throw new Error("Seuls les administrateurs locataires ont un plafond de gestionnaires.");
  }
  await setDoc(
    doc(db, TENANT_ADMIN_LIMITS_COLLECTION, adminUid),
    {
      ownerUid: adminUid,
      maxManagers: Math.floor(maxManagers),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

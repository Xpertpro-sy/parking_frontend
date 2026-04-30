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
  writeBatch,
  type DocumentReference,
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
import { REVOKED_MANAGER_PROFILE_PERMISSIONS } from "@/lib/manager-access-api";

export type TenantAdminAccountStatus = "active" | "inactive" | "purged";

export type PlatformTenantAdminRow = {
  uid: string;
  email: string;
  displayName: string;
  prenom: string;
  nom: string;
  telephone: string;
  createdAtLabel: string | null;
  accountStatus: TenantAdminAccountStatus;
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
  accountStatus: TenantAdminAccountStatus;
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
  accountStatus?: string;
};

type ManagerAccessRow = {
  ownerUid: string;
  managerUid?: string | null;
  managerEmailNormalized?: string;
};

const OWNER_SCOPED_COLLECTIONS = [
  "vehicles",
  "sales",
  "saleReceipts",
  "rentals",
  "rentalReceipts",
  "reservations",
  "repairs",
  "accountMovements",
  "drivers",
  "ecommerceLinks",
  "ecommerceRequests",
  "trashItems",
] as const;

const SUBSCRIPTION_REQUESTS_COLLECTION = "subscriptionRequests";

const BATCH_SIZE = 450;

function parseAccountStatus(raw: unknown): TenantAdminAccountStatus {
  const s = typeof raw === "string" ? raw.toLowerCase() : "active";
  if (s === "inactive" || s === "purged") return s;
  return "active";
}

async function collectRefsForOwner(
  db: ReturnType<typeof getFirebaseDb>,
  col: string,
  ownerUid: string,
): Promise<DocumentReference[]> {
  const snap = await getDocs(query(collection(db, col), where("ownerUid", "==", ownerUid)));
  return snap.docs.map((d) => d.ref);
}

async function deleteRefsInBatches(db: ReturnType<typeof getFirebaseDb>, refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const r of refs.slice(i, i + BATCH_SIZE)) {
      batch.delete(r);
    }
    await batch.commit();
  }
}

async function assertTenantAdminTargetForSuperAdmin(
  db: ReturnType<typeof getFirebaseDb>,
  adminUid: string,
  actorUid: string,
): Promise<{ data: UserDocFields; accountStatus: TenantAdminAccountStatus }> {
  if (adminUid === actorUid) {
    throw new Error("Action impossible sur votre propre compte.");
  }
  const userSnap = await getDoc(doc(db, "users", adminUid));
  if (!userSnap.exists()) {
    throw new Error("Administrateur introuvable.");
  }
  const data = userSnap.data() as UserDocFields;
  if ((data.role ?? "").toUpperCase() !== "ADMIN") {
    throw new Error("Ce compte n'est pas un administrateur locataire.");
  }
  const accountStatus = parseAccountStatus(data.accountStatus);
  if (accountStatus === "purged") {
    throw new Error("Ce compte a déjà été purgé.");
  }
  return { data, accountStatus };
}

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
    accountStatus: parseAccountStatus(data.accountStatus),
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
    .filter((row) => row.accountStatus !== "purged")
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
  const accountStatus = parseAccountStatus(data.accountStatus);
  if (accountStatus === "purged") {
    throw new Error("Ce compte a été clôturé et n'est plus consultable ici.");
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
    accountStatus,
    vehicleCount: vehiclesSnap.size,
    managerAccessCount: managersSnap.size,
    maxManagers,
    subscriptionState,
    subscriptionDaySummary,
  };
}

/**
 * Désactive l’administrateur locataire et tous ses gestionnaires (connexion et API bloquées).
 */
export async function deactivateTenantAdminSuperAdminRequest(adminUid: string): Promise<void> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  const { accountStatus } = await assertTenantAdminTargetForSuperAdmin(db, adminUid, identity.actorUid);
  if (accountStatus === "inactive") {
    return;
  }

  await updateDoc(doc(db, "users", adminUid), {
    accountStatus: "inactive",
    updatedAt: serverTimestamp(),
  });

  const managersSnap = await getDocs(query(collection(db, "managerAccess"), where("ownerUid", "==", adminUid)));
  for (const d of managersSnap.docs) {
    await updateDoc(d.ref, { status: "inactive", updatedAt: serverTimestamp() });
    const row = d.data() as ManagerAccessRow;
    const mUid = row.managerUid;
    if (!mUid) continue;
    const userRef = doc(db, "users", mUid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, { managerStatus: "inactive", updatedAt: serverTimestamp() });
    }
  }
}

/**
 * Réactive l’administrateur et les fiches gestionnaires encore valides (pas supprimés / purgés).
 */
export async function reactivateTenantAdminSuperAdminRequest(adminUid: string): Promise<void> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  const { accountStatus } = await assertTenantAdminTargetForSuperAdmin(db, adminUid, identity.actorUid);
  if (accountStatus === "purged") {
    throw new Error(
      "Ce compte a été définitivement clôturé. La réactivation n’est pas possible depuis l’interface.",
    );
  }
  if (accountStatus === "active") {
    return;
  }

  await updateDoc(doc(db, "users", adminUid), {
    accountStatus: "active",
    updatedAt: serverTimestamp(),
  });

  const managersSnap = await getDocs(query(collection(db, "managerAccess"), where("ownerUid", "==", adminUid)));
  for (const d of managersSnap.docs) {
    const row = d.data() as ManagerAccessRow;
    await updateDoc(d.ref, { status: "active", updatedAt: serverTimestamp() });
    const mUid = row.managerUid;
    if (!mUid) continue;
    const userRef = doc(db, "users", mUid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) continue;
    const ud = userSnap.data() as { role?: string; managerStatus?: string; accountStatus?: string };
    if ((ud.role ?? "").toUpperCase() !== "GESTIONNAIRE") continue;
    if (ud.managerStatus === "removed" || parseAccountStatus(ud.accountStatus) === "purged") continue;
    await updateDoc(userRef, { managerStatus: "active", updatedAt: serverTimestamp() });
  }
}

/**
 * Supprime toutes les données métier de l’entreprise, révoque les gestionnaires et clôture l’admin (fiche « purged »).
 * Les comptes Firebase Authentication restent : supprimez-les manuellement dans la console si vous devez libérer l’e-mail.
 */
export async function purgeTenantAdminWorkspaceSuperAdminRequest(adminUid: string): Promise<void> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  const { data: adminData } = await assertTenantAdminTargetForSuperAdmin(db, adminUid, identity.actorUid);

  const adminEmail = (adminData.email ?? "").trim();

  const managersSnap = await getDocs(query(collection(db, "managerAccess"), where("ownerUid", "==", adminUid)));
  const managerAccessRefs = managersSnap.docs.map((d) => d.ref);

  for (const d of managersSnap.docs) {
    const row = d.data() as ManagerAccessRow;
    const mUid = row.managerUid;
    const mEmail = (row.managerEmailNormalized ?? "").trim();
    if (!mUid) continue;
    await setDoc(
      doc(db, "users", mUid),
      {
        uid: mUid,
        email: mEmail,
        prenom: "",
        nom: "",
        displayName: "Compte fermé",
        role: "GESTIONNAIRE",
        enterpriseOwnerUid: adminUid,
        managerStatus: "removed",
        managerAccessId: null,
        permissions: REVOKED_MANAGER_PROFILE_PERMISSIONS,
        accountStatus: "purged",
        updatedAt: serverTimestamp(),
      },
      { merge: false },
    );
  }

  await deleteRefsInBatches(db, managerAccessRefs);

  const allDeleteRefs: DocumentReference[] = [];
  for (const col of OWNER_SCOPED_COLLECTIONS) {
    const refs = await collectRefsForOwner(db, col, adminUid);
    allDeleteRefs.push(...refs);
  }
  await deleteRefsInBatches(db, allDeleteRefs);

  const requestsSnap = await getDocs(
    query(collection(db, SUBSCRIPTION_REQUESTS_COLLECTION), where("ownerUid", "==", adminUid)),
  );
  await deleteRefsInBatches(db, requestsSnap.docs.map((d) => d.ref));

  try {
    await deleteDoc(doc(db, "tenantSubscriptions", adminUid));
  } catch {
    /* absent */
  }
  try {
    await deleteDoc(doc(db, "tenantAdminLimits", adminUid));
  } catch {
    /* absent */
  }
  try {
    await deleteDoc(doc(db, "brandingSettings", adminUid));
  } catch {
    /* absent */
  }

  await setDoc(
    doc(db, "users", adminUid),
    {
      uid: adminUid,
      email: adminEmail,
      prenom: "",
      nom: "",
      displayName: "Compte clôturé",
      role: "ADMIN",
      accountStatus: "purged",
      purgedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );
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

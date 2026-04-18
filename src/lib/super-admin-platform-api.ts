import { collection, getDocs, query, where, type Timestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getWorkspaceIdentity } from "@/lib/access-control";

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
  email?: string;
  prenom?: string;
  nom?: string;
  displayName?: string;
  telephone?: string | null;
  createdAt?: unknown;
};

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

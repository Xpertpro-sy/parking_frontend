import { doc, getDoc } from "firebase/firestore";
import { getAccessToken } from "@/lib/auth-session";
import { getFirebaseDb, waitForFirebaseUser } from "@/lib/firebase";

export type AppPermission =
  | "dashboard"
  | "vehicles"
  | "receipts"
  | "comptability"
  | "rentals"
  | "reservations"
  | "history"
  | "trash"
  | "settings"
  | "accounts";

export type PermissionMap = Record<AppPermission, boolean>;

export const DEFAULT_ADMIN_PERMISSIONS: PermissionMap = {
  dashboard: true,
  vehicles: true,
  receipts: true,
  comptability: true,
  rentals: true,
  reservations: true,
  history: true,
  trash: true,
  settings: true,
  accounts: true,
};

export const DEFAULT_MANAGER_PERMISSIONS: PermissionMap = {
  dashboard: true,
  vehicles: true,
  receipts: true,
  comptability: true,
  rentals: true,
  reservations: true,
  history: true,
  trash: false,
  settings: false,
  accounts: false,
};

type UserAccessDoc = {
  role?: string;
  enterpriseOwnerUid?: string;
  permissions?: Partial<PermissionMap>;
  displayName?: string;
  prenom?: string;
  nom?: string;
};

type SessionUser = {
  name?: string;
  firstName?: string;
  lastName?: string;
};

export type WorkspaceIdentity = {
  uid: string;
  email: string | null;
  actorUid: string;
  actorName: string;
  role: "ADMIN" | "GESTIONNAIRE";
  permissions: PermissionMap;
};

function formatActorName(userDoc: UserAccessDoc, authDisplayName?: string | null): string {
  const displayName = (userDoc.displayName ?? "").trim();
  if (displayName) return displayName;
  const authName = (authDisplayName ?? "").trim();
  if (authName) return authName;
  const prenom = (userDoc.prenom ?? "").trim();
  const nom = (userDoc.nom ?? "").trim();
  const full = `${prenom} ${nom}`.trim();
  if (full) return full;
  return "Utilisateur";
}

function getSessionUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = sessionStorage.getItem("gestion-parking-current-user");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as SessionUser;
    const name = (parsed.name ?? "").trim();
    if (name) return name;
    const full = `${(parsed.firstName ?? "").trim()} ${(parsed.lastName ?? "").trim()}`.trim();
    return full;
  } catch {
    return "";
  }
}

function normalizeRole(value?: string): "ADMIN" | "GESTIONNAIRE" {
  return value?.toUpperCase() === "GESTIONNAIRE" ? "GESTIONNAIRE" : "ADMIN";
}

function normalizePermissions(role: "ADMIN" | "GESTIONNAIRE", value?: Partial<PermissionMap>): PermissionMap {
  const base = role === "GESTIONNAIRE" ? DEFAULT_MANAGER_PERMISSIONS : DEFAULT_ADMIN_PERMISSIONS;
  if (!value) return base;
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(value).filter((entry): entry is [AppPermission, boolean] => typeof entry[1] === "boolean"),
    ),
  };
}

export async function getWorkspaceIdentity(): Promise<WorkspaceIdentity> {
  const token = getAccessToken();
  if (!token) throw new Error("Session expiree. Veuillez vous reconnecter.");

  const authUser = await waitForFirebaseUser();
  if (!authUser?.uid) throw new Error("Session Firebase invalide. Veuillez vous reconnecter.");

  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "users", authUser.uid));
  const userDoc = (snap.exists() ? (snap.data() as UserAccessDoc) : undefined) ?? {};

  const role = normalizeRole(userDoc.role);
  const resolvedActorName = formatActorName(userDoc, authUser.displayName);
  const ownerUid =
    role === "GESTIONNAIRE" && typeof userDoc.enterpriseOwnerUid === "string" && userDoc.enterpriseOwnerUid.trim()
      ? userDoc.enterpriseOwnerUid.trim()
      : authUser.uid;

  return {
    uid: ownerUid,
    actorUid: authUser.uid,
    email: authUser.email ?? null,
    actorName: resolvedActorName === "Utilisateur" ? getSessionUserName() || "Utilisateur" : resolvedActorName,
    role,
    permissions: normalizePermissions(role, userDoc.permissions),
  };
}

export async function getCurrentUserAccessProfile() {
  return getWorkspaceIdentity();
}


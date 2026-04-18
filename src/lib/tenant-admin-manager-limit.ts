import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  query,
  where,
  type DocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

/** Plafond par défaut si aucun document `tenantAdminLimits` n’existe pour l’admin locataire. */
export const DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN = 2;

export const TENANT_ADMIN_LIMITS_COLLECTION = "tenantAdminLimits";

export const tenantAdminMaxManagersQueryKey = (ownerUid: string) =>
  ["tenant-admin-max-managers", ownerUid] as const;

function parseMaxManagersValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    return n >= 0 && n <= 500 ? n : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Math.floor(Number(raw));
    if (Number.isFinite(n) && n >= 0 && n <= 500) return n;
  }
  return null;
}

function readMaxManagersFromSnapshot(snap: DocumentSnapshot): number {
  if (!snap.exists()) return DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN;
  const parsed = parseMaxManagersValue(snap.data()?.maxManagers);
  return parsed ?? DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN;
}

/** Limite effective (document Firestore ou défaut). */
export async function getTenantAdminMaxManagersAllowed(ownerUid: string): Promise<number> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, TENANT_ADMIN_LIMITS_COLLECTION, ownerUid));
  return readMaxManagersFromSnapshot(snap);
}

/**
 * Lecture côté serveur : évite d’afficher l’ancien plafond (ex. 2) après une mise à jour,
 * lorsque le cache persistant Firestore du navigateur n’est pas encore à jour.
 */
export async function getTenantAdminMaxManagersAllowedFromServer(ownerUid: string): Promise<number> {
  const db = getFirebaseDb();
  const ref = doc(db, TENANT_ADMIN_LIMITS_COLLECTION, ownerUid);
  try {
    const snap = await getDocFromServer(ref);
    return readMaxManagersFromSnapshot(snap);
  } catch {
    const snap = await getDoc(ref);
    return readMaxManagersFromSnapshot(snap);
  }
}

/** Nombre de fiches `managerAccess` pour cet administrateur (une création = un slot). */
export async function countManagerAccessSlotsForOwner(ownerUid: string): Promise<number> {
  const db = getFirebaseDb();
  const snapshot = await getDocs(query(collection(db, "managerAccess"), where("ownerUid", "==", ownerUid)));
  return snapshot.size;
}

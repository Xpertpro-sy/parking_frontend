import {
  addDoc,
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
  type Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getWorkspaceIdentity } from "@/lib/access-control";
import type { VehicleFirestoreDoc } from "@/lib/vehicle-api";
import type { VehicleStatus } from "@/types/vehicle";

export const superAdminEcommerceLinksQueryKey = ["super-admin", "ecommerce-links"] as const;
export const publicEcommerceStoreQueryKey = (token: string) => ["ecommerce-store", token] as const;
export const publicEcommerceRequestStatusQueryKey = (requestId: string) =>
  ["ecommerce-request-status", requestId] as const;
export const ecommerceRequestsQueryKey = ["ecommerce-requests", "list"] as const;
export const ecommerceRequestsCountQueryKey = ["ecommerce-requests", "pending-count"] as const;
export const ecommerceActiveLinkQueryKey = ["ecommerce-link", "active"] as const;

export type EcommerceLinkStatus = "active" | "inactive";

export type SuperAdminEcommerceLinkRow = {
  adminUid: string;
  adminName: string;
  adminEmail: string;
  token: string | null;
  status: EcommerceLinkStatus | null;
  createdAtLabel: string | null;
};

export type PublicEcommerceVehicle = {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  fuel: string;
  mileage: number;
  salePrice: number;
  rentalPrice: number;
  description: string;
  condition: string;
  status: VehicleStatus;
  photos: string[];
};

export type PublicEcommerceStore = {
  ownerUid: string;
  adminName: string;
  adminEmail: string;
  vehicles: PublicEcommerceVehicle[];
};

export type CreateEcommerceRequestPayload = {
  ownerUid: string;
  sourceToken: string;
  vehicleId: string;
  vehicleLabel: string;
  requestType: "reservation" | "rental";
  customerName: string;
  customerPhone: string;
};

export type EcommerceCustomerRequest = {
  id: string;
  ownerUid: string;
  vehicleId: string;
  vehicleLabel: string;
  requestType: "reservation" | "rental";
  customerName: string;
  customerPhone: string;
  status: EcommerceCustomerRequestStatus;
  validatedByName: string | null;
  createdAt: string;
};

export type EcommerceCustomerRequestStatus = "pending" | "contacted" | "validated" | "closed";

type UserDocFields = {
  role?: string;
  email?: string;
  prenom?: string;
  nom?: string;
  displayName?: string;
  accountStatus?: string;
};

type EcommerceLinkDoc = {
  ownerUid: string;
  adminName: string;
  adminEmail: string;
  token: string;
  status: EcommerceLinkStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type EcommerceCustomerRequestDoc = {
  ownerUid: string;
  sourceToken?: string;
  vehicleId: string;
  vehicleLabel: string;
  requestType: "reservation" | "rental";
  customerName: string;
  customerPhone: string;
  status: EcommerceCustomerRequestStatus;
  validatedByUid?: string | null;
  validatedByName?: string | null;
  validatedAt?: string | null;
  createdAt?: Timestamp;
};

function assertSuperAdminRole(role: string | undefined) {
  if (role !== "SUPER_ADMIN") {
    throw new Error("Accès réservé au super administrateur.");
  }
}

function formatFirestoreDate(value: unknown): string | null {
  if (value != null && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return null;
}

function buildDisplayName(uid: string, data: UserDocFields) {
  const prenom = (data.prenom ?? "").trim();
  const nom = (data.nom ?? "").trim();
  return (data.displayName ?? "").trim() || `${prenom} ${nom}`.trim() || (data.email ?? "").trim() || uid;
}

function generateToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeVehicleStatus(value: string): VehicleStatus {
  const normalized = value.trim().toLowerCase();
  if (["available", "sold", "rented", "repair", "reserved"].includes(normalized)) {
    return normalized as VehicleStatus;
  }
  return "available";
}

function mapPublicVehicle(id: string, data: VehicleFirestoreDoc): PublicEcommerceVehicle {
  return {
    id,
    brand: data.brand,
    model: data.model,
    year: data.year,
    color: data.color,
    plate: data.plate,
    fuel: data.fuel,
    mileage: Number(data.mileage) || 0,
    salePrice: Number(data.salePrice) || 0,
    rentalPrice: Number(data.rentalPrice) || 0,
    description: data.description ?? "",
    condition: data.condition,
    status: normalizeVehicleStatus(data.status),
    photos: data.photos ?? [],
  };
}

function mapEcommerceRequest(id: string, data: EcommerceCustomerRequestDoc): EcommerceCustomerRequest {
  return {
    id,
    ownerUid: data.ownerUid,
    vehicleId: data.vehicleId,
    vehicleLabel: data.vehicleLabel,
    requestType: data.requestType,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    status: data.status,
    validatedByName: data.validatedByName ?? null,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
  };
}

export function buildEcommerceUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/shop/${token}`;
}

export async function listSuperAdminEcommerceLinksRequest(): Promise<SuperAdminEcommerceLinkRow[]> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  const [adminsSnap, linksSnap] = await Promise.all([
    getDocs(query(collection(db, "users"), where("role", "==", "ADMIN"))),
    getDocs(collection(db, "ecommerceLinks")),
  ]);
  const linkByOwner = new Map<string, EcommerceLinkDoc>();
  linksSnap.docs.forEach((linkDoc) => {
    const data = linkDoc.data() as EcommerceLinkDoc;
    linkByOwner.set(data.ownerUid, data);
  });

  return adminsSnap.docs
    .map((adminDoc) => {
      const data = adminDoc.data() as UserDocFields;
      const link = linkByOwner.get(adminDoc.id);
      return {
        adminUid: adminDoc.id,
        adminName: buildDisplayName(adminDoc.id, data),
        adminEmail: (data.email ?? "").trim(),
        token: link?.token ?? null,
        status: link?.status ?? null,
        createdAtLabel: link ? formatFirestoreDate(link.createdAt) : null,
      };
    })
    .filter((row) => row.adminEmail || row.adminName)
    .sort((a, b) => a.adminName.localeCompare(b.adminName, "fr", { sensitivity: "base" }));
}

export async function createEcommerceLinkForAdminRequest(adminUid: string): Promise<string> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  const adminSnap = await getDoc(doc(db, "users", adminUid));
  if (!adminSnap.exists()) {
    throw new Error("Administrateur introuvable.");
  }
  const adminData = adminSnap.data() as UserDocFields;
  if ((adminData.role ?? "").toUpperCase() !== "ADMIN") {
    throw new Error("Le lien e-commerce doit être rattaché à un administrateur.");
  }
  if ((adminData.accountStatus ?? "active") === "purged") {
    throw new Error("Ce compte administrateur est clôturé.");
  }

  const linkRef = doc(db, "ecommerceLinks", adminUid);
  const existing = await getDoc(linkRef);
  const token = existing.exists() ? ((existing.data() as EcommerceLinkDoc).token || generateToken()) : generateToken();
  await setDoc(
    linkRef,
    {
      ownerUid: adminUid,
      adminName: buildDisplayName(adminUid, adminData),
      adminEmail: (adminData.email ?? "").trim(),
      token,
      status: "active",
      createdByUid: identity.actorUid,
      createdAt: existing.exists() ? (existing.data() as EcommerceLinkDoc).createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return token;
}

export async function deleteEcommerceLinkForAdminRequest(adminUid: string): Promise<void> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdminRole(identity.role);
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "ecommerceLinks", adminUid));
}

export async function getPublicEcommerceStoreRequest(token: string): Promise<PublicEcommerceStore | null> {
  const db = getFirebaseDb();
  const trimmedToken = token.trim();
  if (!trimmedToken) return null;
  const linkSnap = await getDocs(
    query(collection(db, "ecommerceLinks"), where("token", "==", trimmedToken), where("status", "==", "active")),
  );
  const linkDoc = linkSnap.docs[0];
  if (!linkDoc) return null;
  const link = linkDoc.data() as EcommerceLinkDoc;
  const vehiclesSnap = await getDocs(query(collection(db, "vehicles"), where("ownerUid", "==", link.ownerUid)));
  const vehicles = vehiclesSnap.docs
    .map((vehicleDoc) => mapPublicVehicle(vehicleDoc.id, vehicleDoc.data() as VehicleFirestoreDoc))
    .sort((a, b) => a.brand.localeCompare(b.brand, "fr", { sensitivity: "base" }));
  return {
    ownerUid: link.ownerUid,
    adminName: link.adminName,
    adminEmail: link.adminEmail,
    vehicles,
  };
}

export async function createEcommerceCustomerRequest(payload: CreateEcommerceRequestPayload): Promise<string> {
  if (!payload.customerName.trim() || !payload.customerPhone.trim()) {
    throw new Error("Nom et téléphone sont obligatoires.");
  }
  const db = getFirebaseDb();
  const requestRef = await addDoc(collection(db, "ecommerceRequests"), {
    ownerUid: payload.ownerUid,
    sourceToken: payload.sourceToken,
    vehicleId: payload.vehicleId,
    vehicleLabel: payload.vehicleLabel,
    requestType: payload.requestType,
    customerName: payload.customerName.trim(),
    customerPhone: payload.customerPhone.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return requestRef.id;
}

export async function getPublicEcommerceCustomerRequestStatusRequest(
  requestId: string,
): Promise<EcommerceCustomerRequest | null> {
  const db = getFirebaseDb();
  if (!requestId.trim()) return null;
  const requestSnap = await getDoc(doc(db, "ecommerceRequests", requestId));
  if (!requestSnap.exists()) return null;
  return mapEcommerceRequest(requestSnap.id, requestSnap.data() as EcommerceCustomerRequestDoc);
}

export async function listEcommerceCustomerRequestsRequest(): Promise<EcommerceCustomerRequest[]> {
  const db = getFirebaseDb();
  const identity = await getWorkspaceIdentity();
  const snapshot = await getDocs(query(collection(db, "ecommerceRequests"), where("ownerUid", "==", identity.uid)));
  return snapshot.docs
    .map((requestDoc) => mapEcommerceRequest(requestDoc.id, requestDoc.data() as EcommerceCustomerRequestDoc))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function countPendingEcommerceCustomerRequestsRequest(): Promise<number> {
  const requests = await listEcommerceCustomerRequestsRequest();
  return requests.filter((request) => request.status === "pending").length;
}

export async function hasActiveEcommerceLinkRequest(): Promise<boolean> {
  const db = getFirebaseDb();
  const identity = await getWorkspaceIdentity();
  const linkSnap = await getDoc(doc(db, "ecommerceLinks", identity.uid));
  if (!linkSnap.exists()) return false;
  const link = linkSnap.data() as EcommerceLinkDoc;
  return link.status === "active";
}

export async function updateEcommerceCustomerRequestStatusRequest(
  requestId: string,
  status: EcommerceCustomerRequest["status"],
): Promise<void> {
  const db = getFirebaseDb();
  const identity = await getWorkspaceIdentity();
  const requestRef = doc(db, "ecommerceRequests", requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) {
    throw new Error("Demande introuvable.");
  }
  const requestData = requestSnap.data() as EcommerceCustomerRequestDoc;
  if (requestData.ownerUid !== identity.uid) {
    throw new Error("Accès refusé à cette demande.");
  }
  const updatePayload: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "validated") {
    updatePayload.validatedByUid = identity.actorUid;
    updatePayload.validatedByName = identity.actorName;
    updatePayload.validatedAt = new Date().toISOString();
  }
  await updateDoc(requestRef, updatePayload);
}

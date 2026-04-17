import { getWorkspaceIdentity } from "@/lib/access-control";
import { getFirebaseDb } from "@/lib/firebase";
import { Vehicle, VehicleStatus } from "@/types/vehicle";
import {
  addDoc,
  collection,
  doc,
  FieldValue,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";

export type CreateVehiclePayload = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  fuel: string;
  mileage: number;
  salePrice: number;
  rentalPrice: number;
  description?: string;
  condition: string;
  photos: string[];
};

export type UpdateVehiclePayload = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  fuel: string;
  mileage: number;
  salePrice: number;
  rentalPrice: number;
  description?: string;
  condition: string;
  photos: string[];
  status?: string;
};

export type VehicleApiResponse = {
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
  description: string | null;
  condition: string;
  status: string;
  photos: string[];
  createdAt: string;
  createdByName: string;
  ownerUserId: number;
};

export type VehicleFirestoreDoc = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  plateNormalized: string;
  fuel: string;
  mileage: number;
  salePrice: number;
  rentalPrice: number;
  description: string;
  condition: string;
  status: string;
  photos: string[];
  ownerUid: string;
  ownerEmail: string | null;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type VehicleFirestoreCreateDoc = Omit<VehicleFirestoreDoc, "createdAt" | "updatedAt"> & {
  createdAt: FieldValue;
  updatedAt: FieldValue;
};

type VehicleFirestoreUpdateDoc = Partial<Omit<VehicleFirestoreDoc, "updatedAt">> & {
  updatedAt: FieldValue;
};

function mapStatus(status: string): VehicleStatus {
  const normalized = status.trim().toLowerCase();
  const knownStatuses: VehicleStatus[] = ["available", "sold", "rented", "repair", "reserved"];
  if (knownStatuses.includes(normalized as VehicleStatus)) {
    return normalized as VehicleStatus;
  }
  return "available";
}

export function mapVehicleApiResponseToVehicle(apiVehicle: VehicleApiResponse): Vehicle {
  return {
    id: apiVehicle.id,
    brand: apiVehicle.brand,
    model: apiVehicle.model,
    year: apiVehicle.year,
    color: apiVehicle.color,
    plate: apiVehicle.plate,
    fuel: apiVehicle.fuel,
    mileage: apiVehicle.mileage,
    salePrice: apiVehicle.salePrice,
    rentalPrice: apiVehicle.rentalPrice,
    description: apiVehicle.description ?? "",
    condition: apiVehicle.condition,
    status: mapStatus(apiVehicle.status),
    photos: apiVehicle.photos ?? [],
    createdAt: apiVehicle.createdAt,
    createdByName: apiVehicle.createdByName,
  };
}

async function getAuthIdentity() {
  const identity = await getWorkspaceIdentity();
  return { uid: identity.uid, email: identity.email, actorUid: identity.actorUid, actorName: identity.actorName };
}

function normalizePlate(plate: string): string {
  return plate.trim().replace(/\s+/g, "").toUpperCase();
}

function vehicleFromFirestore(id: string, data: VehicleFirestoreDoc): Vehicle {
  const name =
    data.createdByName && data.createdByName.trim() && data.createdByName.trim().toLowerCase() !== "utilisateur"
      ? data.createdByName.trim()
      : "";
  return mapVehicleApiResponseToVehicle({
    id,
    brand: data.brand,
    model: data.model,
    year: data.year,
    color: data.color,
    plate: data.plate,
    fuel: data.fuel,
    mileage: data.mileage,
    salePrice: data.salePrice,
    rentalPrice: data.rentalPrice,
    description: data.description ?? "",
    condition: data.condition,
    status: data.status,
    photos: data.photos ?? [],
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    createdByName: name || "Utilisateur",
    ownerUserId: 0,
  });
}

async function assertPlateUnique(ownerUid: string, plate: string, excludeVehicleId?: string) {
  const db = getFirebaseDb();
  const existing = await getDocs(
    query(
      collection(db, "vehicles"),
      where("ownerUid", "==", ownerUid),
      where("plateNormalized", "==", normalizePlate(plate)),
    ),
  );
  const conflict = existing.docs.find((docSnap) => docSnap.id !== excludeVehicleId);
  if (conflict) {
    throw new Error("Une voiture avec cette immatriculation existe deja.");
  }
}

export async function createVehicleRequest(payload: CreateVehiclePayload): Promise<VehicleApiResponse> {
  const db = getFirebaseDb();
  const { uid, email, actorUid, actorName } = await getAuthIdentity();
  await assertPlateUnique(uid, payload.plate);

  const docPayload: VehicleFirestoreCreateDoc = {
    brand: payload.brand.trim(),
    model: payload.model.trim(),
    year: Number(payload.year),
    color: payload.color.trim(),
    plate: normalizePlate(payload.plate),
    plateNormalized: normalizePlate(payload.plate),
    fuel: payload.fuel.trim(),
    mileage: Number(payload.mileage),
    salePrice: Number(payload.salePrice),
    rentalPrice: Number(payload.rentalPrice),
    description: (payload.description ?? "").trim(),
    condition: payload.condition.trim(),
    status: "available",
    photos: payload.photos ?? [],
    ownerUid: uid,
    ownerEmail: email,
    createdByUid: actorUid,
    createdByName: actorName,
    createdByEmail: email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const createdRef = await addDoc(collection(db, "vehicles"), docPayload);
  const createdSnap = await getDoc(createdRef);
  const createdData = createdSnap.data() as VehicleFirestoreDoc | undefined;
  if (!createdData) throw new Error("Creation du vehicule echouee.");
  return {
    id: createdRef.id,
    brand: createdData.brand,
    model: createdData.model,
    year: createdData.year,
    color: createdData.color,
    plate: createdData.plate,
    fuel: createdData.fuel,
    mileage: createdData.mileage,
    salePrice: createdData.salePrice,
    rentalPrice: createdData.rentalPrice,
    description: createdData.description,
    condition: createdData.condition,
    status: createdData.status,
    photos: createdData.photos ?? [],
    createdAt: createdData.createdAt ? createdData.createdAt.toDate().toISOString() : new Date().toISOString(),
    createdByName: (createdData.createdByName && createdData.createdByName.trim().toLowerCase() !== "utilisateur" ? createdData.createdByName : "Utilisateur"),
    ownerUserId: 0,
  };
}

export async function updateVehicleRequest(vehicleId: string, payload: UpdateVehiclePayload): Promise<VehicleApiResponse> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const ref = doc(db, "vehicles", vehicleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Vehicule introuvable.");
  }
  const existing = snap.data() as VehicleFirestoreDoc;
  if (existing.ownerUid !== uid) {
    throw new Error("Acces refuse a ce vehicule.");
  }
  await assertPlateUnique(uid, payload.plate, vehicleId);

  const updatePayload: VehicleFirestoreUpdateDoc = {
    brand: payload.brand.trim(),
    model: payload.model.trim(),
    year: Number(payload.year),
    color: payload.color.trim(),
    plate: normalizePlate(payload.plate),
    plateNormalized: normalizePlate(payload.plate),
    fuel: payload.fuel.trim(),
    mileage: Number(payload.mileage),
    salePrice: Number(payload.salePrice),
    rentalPrice: Number(payload.rentalPrice),
    description: (payload.description ?? "").trim(),
    condition: payload.condition.trim(),
    photos: payload.photos ?? [],
    updatedAt: serverTimestamp(),
  };
  if (payload.status) {
    updatePayload.status = payload.status.trim().toLowerCase();
  }
  await updateDoc(ref, updatePayload);
  const updatedSnap = await getDoc(ref);
  const updatedData = updatedSnap.data() as VehicleFirestoreDoc | undefined;
  if (!updatedData) {
    throw new Error("Mise a jour du vehicule echouee.");
  }
  return {
    id: vehicleId,
    brand: updatedData.brand,
    model: updatedData.model,
    year: updatedData.year,
    color: updatedData.color,
    plate: updatedData.plate,
    fuel: updatedData.fuel,
    mileage: updatedData.mileage,
    salePrice: updatedData.salePrice,
    rentalPrice: updatedData.rentalPrice,
    description: updatedData.description,
    condition: updatedData.condition,
    status: updatedData.status,
    photos: updatedData.photos ?? [],
    createdAt: updatedData.createdAt ? updatedData.createdAt.toDate().toISOString() : new Date().toISOString(),
    createdByName: (updatedData.createdByName && updatedData.createdByName.trim().toLowerCase() !== "utilisateur" ? updatedData.createdByName : "Utilisateur"),
    ownerUserId: 0,
  };
}

export async function listVehiclesRequest(): Promise<Vehicle[]> {
  const db = getFirebaseDb();
  const { uid, actorName } = await getAuthIdentity();
  const q = query(collection(db, "vehicles"), where("ownerUid", "==", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => {
      const item = vehicleFromFirestore(d.id, d.data() as VehicleFirestoreDoc);
      if (!item.createdByName || item.createdByName.toLowerCase() === "utilisateur") {
        item.createdByName = actorName;
      }
      return item;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getVehicleByIdRequest(vehicleId: string): Promise<Vehicle | null> {
  const db = getFirebaseDb();
  const { uid, actorName } = await getAuthIdentity();
  const snap = await getDoc(doc(db, "vehicles", vehicleId));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as VehicleFirestoreDoc;
  if (data.ownerUid !== uid) {
    return null;
  }
  const item = vehicleFromFirestore(snap.id, data);
  if (!item.createdByName || item.createdByName.toLowerCase() === "utilisateur") {
    item.createdByName = actorName;
  }
  return item;
}

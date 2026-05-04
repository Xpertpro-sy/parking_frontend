import { getWorkspaceIdentity } from "@/lib/access-control";
import { getFirebaseDb } from "@/lib/firebase";
import type { VehicleFirestoreDoc } from "@/lib/vehicle-api";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

export type CreateRentalPayload = {
  vehicleId: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl?: string;
  tenantAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  startDate: string;
  endDate: string;
  amount: number;
  dailyPrice?: number;
  driver?: RentalDriverPayload;
};

export type RentalDriverPayload = {
  fullName: string;
  phone: string;
};

export type RentalApiResponse = {
  id: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  ownerUid: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl: string | null;
  tenantAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyPrice: number;
  amount: number;
  startMileage: number | null;
  endMileage: number | null;
  mileageDifference: number | null;
  driverId: string | null;
  driverFullName: string | null;
  driverPhone: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
  createdByName: string;
  receipt: RentalReceiptApiResponse | null;
};

export type RentalReceiptApiResponse = {
  id: string;
  receiptNumber: string;
  rentalId: string;
  vehicleId: string;
  ownerUid: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyPrice: number;
  rentalAmount: number;
  issuedAt: string;
  createdByName: string;
};

type RentalFirestoreDoc = {
  vehicleId: string;
  ownerUid: string;
  ownerEmail: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl: string | null;
  tenantAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyPrice: number;
  amount: number;
  startMileage?: number | null;
  endMileage?: number | null;
  mileageDifference?: number | null;
  driverId?: string | null;
  driverFullName?: string | null;
  driverPhone?: string | null;
  status: "active" | "completed";
  completedAt: string | null;
  receiptId: string | null;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type RentalReceiptFirestoreDoc = {
  receiptNumber: string;
  rentalId: string;
  vehicleId: string;
  ownerUid: string;
  ownerEmail: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyPrice: number;
  rentalAmount: number;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string | null;
  issuedAt?: Timestamp;
  createdAt?: Timestamp;
};

async function getAuthIdentity() {
  const identity = await getWorkspaceIdentity();
  return {
    uid: identity.uid,
    email: identity.email,
    actorUid: identity.actorUid,
    actorName: identity.actorName,
  };
}

function parseDateTime(value: string, fieldLabel: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} invalide.`);
  }
  return parsed;
}

function computeTotalDays(startDate: Date, endDate: Date): number {
  const minutes = (endDate.getTime() - startDate.getTime()) / (60 * 1000);
  return Math.max(1, Math.ceil(minutes / (24 * 60)));
}

function buildRentalReceiptNumber(endDateIso: string, rentalId: string) {
  const endDate = new Date(endDateIso);
  const yyyy = endDate.getFullYear();
  const mm = String(endDate.getMonth() + 1).padStart(2, "0");
  const dd = String(endDate.getDate()).padStart(2, "0");
  return `LOC-${yyyy}${mm}${dd}-${rentalId.slice(0, 8).toUpperCase()}`;
}

function mapRentalDoc(id: string, data: RentalFirestoreDoc): RentalApiResponse {
  return {
    id,
    vehicleId: data.vehicleId,
    vehicleBrand: data.vehicleBrand,
    vehicleModel: data.vehicleModel,
    vehiclePlate: data.vehiclePlate,
    ownerUid: data.ownerUid,
    tenantName: data.tenantName,
    tenantPhone: data.tenantPhone,
    tenantIdCardNumber: data.tenantIdCardNumber,
    tenantIdCardPhotoUrl: data.tenantIdCardPhotoUrl,
    tenantAddress: data.tenantAddress,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    startDate: data.startDate,
    endDate: data.endDate,
    totalDays: data.totalDays,
    dailyPrice: data.dailyPrice,
    amount: data.amount,
    startMileage: data.startMileage ?? null,
    endMileage: data.endMileage ?? null,
    mileageDifference: data.mileageDifference ?? null,
    driverId: data.driverId ?? null,
    driverFullName: data.driverFullName ?? null,
    driverPhone: data.driverPhone ?? null,
    status: data.status,
    completedAt: data.completedAt,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    createdByName: data.createdByName && data.createdByName.trim().toLowerCase() !== "utilisateur" ? data.createdByName : "Utilisateur",
    receipt: null,
  };
}

function mapRentalReceiptDoc(id: string, data: RentalReceiptFirestoreDoc): RentalReceiptApiResponse {
  return {
    id,
    receiptNumber: data.receiptNumber,
    rentalId: data.rentalId,
    vehicleId: data.vehicleId,
    ownerUid: data.ownerUid,
    vehicleBrand: data.vehicleBrand,
    vehicleModel: data.vehicleModel,
    vehiclePlate: data.vehiclePlate,
    tenantName: data.tenantName,
    tenantPhone: data.tenantPhone,
    tenantIdCardNumber: data.tenantIdCardNumber,
    tenantIdCardPhotoUrl: data.tenantIdCardPhotoUrl,
    startDate: data.startDate,
    endDate: data.endDate,
    totalDays: data.totalDays,
    dailyPrice: data.dailyPrice,
    rentalAmount: data.rentalAmount,
    issuedAt: data.issuedAt ? data.issuedAt.toDate().toISOString() : new Date().toISOString(),
    createdByName: data.createdByName && data.createdByName.trim().toLowerCase() !== "utilisateur" ? data.createdByName : "Utilisateur",
  };
}

export async function createRentalRequest(payload: CreateRentalPayload): Promise<RentalApiResponse> {
  const db = getFirebaseDb();
  const { uid, email, actorUid, actorName } = await getAuthIdentity();

  if (!payload.tenantName.trim()) throw new Error("Le nom du locataire est obligatoire.");
  if (!payload.tenantPhone.trim()) throw new Error("Le telephone du locataire est obligatoire.");
  if (!payload.tenantIdCardNumber.trim()) throw new Error("Le numero de piece est obligatoire.");
  const driver = payload.driver;
  if (driver && (!driver.fullName.trim() || !driver.phone.trim())) {
    throw new Error("Le nom complet et le numero du chauffeur sont obligatoires.");
  }

  const startDate = parseDateTime(payload.startDate, "Date de debut");
  const endDate = parseDateTime(payload.endDate, "Date de fin");
  if (endDate <= startDate) {
    throw new Error("La date de fin doit etre apres la date de debut.");
  }

  const vehicleRef = doc(db, "vehicles", payload.vehicleId);
  const rentalRef = doc(collection(db, "rentals"));
  const receiptRef = doc(collection(db, "rentalReceipts"));
  const movementRef = doc(collection(db, "accountMovements"));
  const driverRef = driver ? doc(collection(db, "drivers")) : null;

  await runTransaction(db, async (transaction) => {
    const vehicleSnap = await transaction.get(vehicleRef);
    if (!vehicleSnap.exists()) {
      throw new Error("Vehicule introuvable.");
    }
    const vehicle = vehicleSnap.data() as VehicleFirestoreDoc;
    if (vehicle.ownerUid !== uid) {
      throw new Error("Acces refuse a ce vehicule.");
    }
    if (vehicle.status !== "available") {
      throw new Error("Seuls les vehicules disponibles peuvent etre loues.");
    }

    const totalDays = computeTotalDays(startDate, endDate);
    const vehicleDailyPrice = Number(vehicle.rentalPrice) || 0;
    const dailyPrice = vehicleDailyPrice > 0 ? vehicleDailyPrice : Number(payload.dailyPrice) || 0;
    if (dailyPrice <= 0) {
      throw new Error("Le prix de location par jour est obligatoire pour ce vehicule.");
    }
    const expectedAmount = totalDays * dailyPrice;
    if (Number(payload.amount) !== expectedAmount) {
      throw new Error("Le montant calcule est invalide. Veuillez verifier les dates.");
    }
    const receiptNumber = buildRentalReceiptNumber(endDate.toISOString(), rentalRef.id);
    const driverFullName = driver?.fullName.trim() || null;
    const driverPhone = driver?.phone.trim() || null;

    transaction.set(rentalRef, {
      vehicleId: payload.vehicleId,
      ownerUid: uid,
      ownerEmail: email,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      tenantName: payload.tenantName.trim(),
      tenantPhone: payload.tenantPhone.trim(),
      tenantIdCardNumber: payload.tenantIdCardNumber.trim(),
      tenantIdCardPhotoUrl: payload.tenantIdCardPhotoUrl?.trim() || null,
      tenantAddress: payload.tenantAddress?.trim() || null,
      emergencyContactName: payload.emergencyContactName?.trim() || null,
      emergencyContactPhone: payload.emergencyContactPhone?.trim() || null,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalDays,
      dailyPrice,
      amount: expectedAmount,
      startMileage: Number(vehicle.mileage) || 0,
      endMileage: null,
      mileageDifference: null,
      driverId: driverRef?.id ?? null,
      driverFullName,
      driverPhone,
      status: "active",
      completedAt: null,
      receiptId: receiptRef.id,
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (driverRef && driverFullName && driverPhone) {
      transaction.set(driverRef, {
        ownerUid: uid,
        ownerEmail: email,
        fullName: driverFullName,
        phone: driverPhone,
        rentalId: rentalRef.id,
        vehicleId: payload.vehicleId,
        vehicleBrand: vehicle.brand,
        vehicleModel: vehicle.model,
        vehiclePlate: vehicle.plate,
        status: "assigned",
        createdByUid: actorUid,
        createdByName: actorName,
        createdByEmail: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    transaction.set(receiptRef, {
      receiptNumber,
      rentalId: rentalRef.id,
      vehicleId: payload.vehicleId,
      ownerUid: uid,
      ownerEmail: email,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      tenantName: payload.tenantName.trim(),
      tenantPhone: payload.tenantPhone.trim(),
      tenantIdCardNumber: payload.tenantIdCardNumber.trim(),
      tenantIdCardPhotoUrl: payload.tenantIdCardPhotoUrl?.trim() || null,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalDays,
      dailyPrice,
      rentalAmount: expectedAmount,
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      issuedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    transaction.set(movementRef, {
      ownerUid: uid,
      ownerEmail: email,
      operationType: "rental",
      direction: "entree",
      category: "Location",
      source: "caisse",
      reference: receiptNumber,
      amount: expectedAmount,
      unitPrice: dailyPrice,
      quantity: totalDays,
      operationDate: startDate.toISOString(),
      vehicleId: payload.vehicleId,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      counterpartyName: payload.tenantName.trim(),
      counterpartyPhone: payload.tenantPhone.trim(),
      description: `Location vehicule ${vehicle.brand} ${vehicle.model}`,
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(vehicleRef, {
      status: "rented",
      updatedAt: serverTimestamp(),
      currentRentalId: rentalRef.id,
    });
  });

  const createdSnap = await getDoc(rentalRef);
  const createdData = createdSnap.data() as RentalFirestoreDoc | undefined;
  if (!createdData) {
    throw new Error("La location a ete enregistree, mais la lecture a echoue.");
  }
  return mapRentalDoc(rentalRef.id, createdData);
}

export async function listRentalsRequest(): Promise<RentalApiResponse[]> {
  const db = getFirebaseDb();
  const { uid, actorName } = await getAuthIdentity();

  const rentalsSnap = await getDocs(query(collection(db, "rentals"), where("ownerUid", "==", uid)));
  const receiptsSnap = await getDocs(query(collection(db, "rentalReceipts"), where("ownerUid", "==", uid)));
  const receiptByRentalId = new Map(
    receiptsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as RentalReceiptFirestoreDoc;
      return [data.rentalId, mapRentalReceiptDoc(docSnap.id, data)] as const;
    }),
  );

  return rentalsSnap.docs
    .map((docSnap) => {
      const data = docSnap.data() as RentalFirestoreDoc;
      return {
        ...mapRentalDoc(docSnap.id, data),
        receipt: receiptByRentalId.get(docSnap.id) ?? null,
      };
    })
    .map((item) => {
      if (!item.createdByName || item.createdByName.toLowerCase() === "utilisateur") {
        item.createdByName = actorName;
      }
      if (item.receipt && (!item.receipt.createdByName || item.receipt.createdByName.toLowerCase() === "utilisateur")) {
        item.receipt.createdByName = actorName;
      }
      return item;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function completeRentalRequest(rentalId: string, endMileage: number): Promise<RentalApiResponse> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const rentalRef = doc(db, "rentals", rentalId);
  if (!Number.isFinite(endMileage) || endMileage < 0) {
    throw new Error("Le kilometrage de retour est invalide.");
  }

  await runTransaction(db, async (transaction) => {
    const rentalSnap = await transaction.get(rentalRef);
    if (!rentalSnap.exists()) {
      throw new Error("Location introuvable.");
    }
    const rental = rentalSnap.data() as RentalFirestoreDoc;
    if (rental.ownerUid !== uid) {
      throw new Error("Acces refuse a cette location.");
    }
    if (rental.status !== "active") {
      throw new Error("Cette location est deja terminee.");
    }

    const vehicleRef = doc(db, "vehicles", rental.vehicleId);
    const vehicleSnap = await transaction.get(vehicleRef);
    if (!vehicleSnap.exists()) {
      throw new Error("Vehicule associe introuvable.");
    }
    const vehicle = vehicleSnap.data() as VehicleFirestoreDoc;
    const fallbackStartMileage = Number(vehicle.mileage);
    const startMileage = rental.startMileage ?? (Number.isFinite(fallbackStartMileage) ? fallbackStartMileage : 0);
    if (endMileage < startMileage) {
      throw new Error("Le kilometrage de retour ne peut pas etre inferieur au kilometrage de depart.");
    }
    const mileageDifference = endMileage - startMileage;

    transaction.update(rentalRef, {
      status: "completed",
      completedAt: new Date().toISOString(),
      startMileage,
      endMileage,
      mileageDifference,
      updatedAt: serverTimestamp(),
    });

    transaction.update(vehicleRef, {
      status: "available",
      mileage: endMileage,
      updatedAt: serverTimestamp(),
      currentRentalId: null,
    });

    if (rental.driverId) {
      transaction.update(doc(db, "drivers", rental.driverId), {
        status: "completed",
        completedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  const updatedRentalSnap = await getDoc(rentalRef);
  const updatedRentalData = updatedRentalSnap.data() as RentalFirestoreDoc | undefined;
  const receipt = await getReceiptByRentalIdRequest(rentalId);

  if (!updatedRentalData) {
    throw new Error("Location terminee, mais impossible de relire les donnees.");
  }
  return {
    ...mapRentalDoc(rentalId, updatedRentalData),
    receipt,
  };
}

export async function reconcileVehicleRentalStatusRequest(vehicleId: string): Promise<boolean> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const vehicleRef = doc(db, "vehicles", vehicleId);

  const [vehicleSnap, activeRentalSnap] = await Promise.all([
    getDoc(vehicleRef),
    getDocs(
      query(
        collection(db, "rentals"),
        where("ownerUid", "==", uid),
        where("vehicleId", "==", vehicleId),
        where("status", "==", "active"),
      ),
    ),
  ]);

  if (!vehicleSnap.exists()) return false;
  const vehicle = vehicleSnap.data() as VehicleFirestoreDoc;
  if (vehicle.ownerUid !== uid) return false;

  const hasActiveRental = !activeRentalSnap.empty;
  if (vehicle.status !== "rented" || hasActiveRental) return false;

  await updateDoc(vehicleRef, {
    status: "available",
    currentRentalId: null,
    updatedAt: serverTimestamp(),
  });
  return true;
}

export async function getReceiptByRentalIdRequest(rentalId: string): Promise<RentalReceiptApiResponse | null> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const receiptSnap = await getDocs(
    query(collection(db, "rentalReceipts"), where("rentalId", "==", rentalId), where("ownerUid", "==", uid)),
  );
  const receiptDoc = receiptSnap.docs[0];
  if (!receiptDoc) {
    return null;
  }
  return mapRentalReceiptDoc(receiptDoc.id, receiptDoc.data() as RentalReceiptFirestoreDoc);
}

export async function listRentalReceiptsRequest(): Promise<RentalReceiptApiResponse[]> {
  const db = getFirebaseDb();
  const { uid, actorName } = await getAuthIdentity();
  const receiptSnap = await getDocs(query(collection(db, "rentalReceipts"), where("ownerUid", "==", uid)));
  return receiptSnap.docs
    .map((docSnap) => {
      const item = mapRentalReceiptDoc(docSnap.id, docSnap.data() as RentalReceiptFirestoreDoc);
      if (!item.createdByName || item.createdByName.toLowerCase() === "utilisateur") {
        item.createdByName = actorName;
      }
      return item;
    })
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
}

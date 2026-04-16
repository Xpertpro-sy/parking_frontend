import { getAccessToken } from "@/context/AuthContext";
import { getFirebaseDb, waitForFirebaseUser } from "@/lib/firebase";
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
} from "firebase/firestore";

export type CreateReservationPayload = {
  customerName: string;
  customerPhone: string;
  notes?: string;
  reservationDate: string;
  amountPaid: number;
};

export type CreateRepairPayload = {
  reason: string;
  cost: number;
  startDate: string;
};

export type FinalizeReservationToRentalPayload = {
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl?: string;
  tenantAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  startDate: string;
  endDate: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8080";

export type ReservationApiResponse = {
  id: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  ownerUid: string;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  reservationDate: string;
  amountPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  cancelledAt: string | null;
  createdAt: string;
};

type ReservationFirestoreDoc = {
  vehicleId: string;
  ownerUid: string;
  ownerEmail: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  reservationDate: string;
  amountPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  cancelledAt: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
  status: "active" | "completed";
  completedAt: string | null;
  receiptId: string | null;
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
  issuedAt?: Timestamp;
  createdAt?: Timestamp;
};

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    if (data.error) return data.error;
    if (data.message) return data.message;
  } catch {
    // Ignore parsing failure
  }
  if (response.status === 401) {
    return "Session expiree. Veuillez vous reconnecter.";
  }
  return "Erreur serveur. Veuillez reessayer.";
}

function getTokenOrThrow() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }
  return token;
}

async function postWithAuth(endpoint: string, payload: unknown) {
  const token = getTokenOrThrow();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

async function getAuthIdentity() {
  const user = await waitForFirebaseUser();
  if (!user?.uid) {
    throw new Error("Session Firebase invalide. Veuillez vous reconnecter.");
  }
  return { uid: user.uid, email: user.email ?? null };
}

function parseReservationDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Jour de reservation invalide.");
  }
  return parsed.toISOString();
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

function mapReservationDoc(id: string, data: ReservationFirestoreDoc): ReservationApiResponse {
  return {
    id,
    vehicleId: data.vehicleId,
    vehicleBrand: data.vehicleBrand,
    vehicleModel: data.vehicleModel,
    vehiclePlate: data.vehiclePlate,
    ownerUid: data.ownerUid,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    notes: data.notes,
    reservationDate: data.reservationDate,
    amountPaid: data.amountPaid,
    status: data.status,
    cancelledAt: data.cancelledAt,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
  };
}

export async function createReservationRequest(vehicleId: string, payload: CreateReservationPayload): Promise<void> {
  const db = getFirebaseDb();
  const { uid, email } = await getAuthIdentity();

  if (!payload.customerName.trim() || !payload.customerPhone.trim()) {
    throw new Error("Nom et telephone du client sont obligatoires.");
  }
  if (!Number.isFinite(payload.amountPaid) || payload.amountPaid < 0) {
    throw new Error("Montant paye invalide.");
  }

  const reservationDateIso = parseReservationDate(payload.reservationDate);
  const vehicleRef = doc(db, "vehicles", vehicleId);
  const reservationRef = doc(collection(db, "reservations"));

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
      throw new Error("Seuls les vehicules disponibles peuvent etre reserves.");
    }
    if (payload.amountPaid > Number(vehicle.rentalPrice)) {
      throw new Error("Le montant paye ne peut pas depasser le prix de location de la voiture.");
    }

    transaction.set(reservationRef, {
      vehicleId,
      ownerUid: uid,
      ownerEmail: email,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      customerName: payload.customerName.trim(),
      customerPhone: payload.customerPhone.trim(),
      notes: payload.notes?.trim() || null,
      reservationDate: reservationDateIso,
      amountPaid: Number(payload.amountPaid),
      status: "ACTIVE",
      cancelledAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(vehicleRef, {
      status: "reserved",
      updatedAt: serverTimestamp(),
      activeReservationId: reservationRef.id,
    });
  });
}

export async function createRepairRequest(vehicleId: string, payload: CreateRepairPayload): Promise<void> {
  await postWithAuth(`/api/auth/vehicles/${vehicleId}/repairs`, payload);
}

export async function finalizeReservationToRentalRequest(
  vehicleId: string,
  payload: FinalizeReservationToRentalPayload,
): Promise<void> {
  const db = getFirebaseDb();
  const { uid, email } = await getAuthIdentity();

  if (!payload.tenantIdCardNumber.trim()) {
    throw new Error("Le numero de piece du locataire est obligatoire.");
  }
  if (!payload.tenantName.trim() || !payload.tenantPhone.trim()) {
    throw new Error("Nom et telephone du locataire sont obligatoires.");
  }
  const startDate = parseDateTime(payload.startDate, "Date de debut");
  const endDate = parseDateTime(payload.endDate, "Date de fin");
  if (endDate <= startDate) {
    throw new Error("La date de fin doit etre apres la date de debut.");
  }

  const vehicleRef = doc(db, "vehicles", vehicleId);
  const rentalRef = doc(collection(db, "rentals"));
  const receiptRef = doc(collection(db, "rentalReceipts"));

  await runTransaction(db, async (transaction) => {
    const vehicleSnap = await transaction.get(vehicleRef);
    if (!vehicleSnap.exists()) {
      throw new Error("Vehicule introuvable.");
    }
    const vehicleData = vehicleSnap.data() as VehicleFirestoreDoc & { activeReservationId?: string | null };
    if (vehicleData.ownerUid !== uid) {
      throw new Error("Acces refuse a ce vehicule.");
    }
    if (vehicleData.status !== "reserved") {
      throw new Error("Ce vehicule doit etre reserve pour lancer la location.");
    }
    if (!vehicleData.activeReservationId) {
      throw new Error("Aucune reservation active reliee a ce vehicule.");
    }

    const reservationRef = doc(db, "reservations", vehicleData.activeReservationId);
    const reservationSnap = await transaction.get(reservationRef);
    if (!reservationSnap.exists()) {
      throw new Error("Reservation introuvable.");
    }
    const reservationData = reservationSnap.data() as ReservationFirestoreDoc;
    if (reservationData.ownerUid !== uid || reservationData.status !== "ACTIVE") {
      throw new Error("Reservation inactive ou inaccessible.");
    }

    const totalDays = computeTotalDays(startDate, endDate);
    const dailyPrice = Number(vehicleData.rentalPrice);
    const amount = totalDays * dailyPrice;
    const receiptNumber = buildRentalReceiptNumber(endDate.toISOString(), rentalRef.id);

    const rentalPayload: RentalFirestoreDoc = {
      vehicleId,
      ownerUid: uid,
      ownerEmail: email,
      vehicleBrand: vehicleData.brand,
      vehicleModel: vehicleData.model,
      vehiclePlate: vehicleData.plate,
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
      amount,
      status: "active",
      completedAt: null,
      receiptId: receiptRef.id,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };

    const receiptPayload: RentalReceiptFirestoreDoc = {
      receiptNumber,
      rentalId: rentalRef.id,
      vehicleId,
      ownerUid: uid,
      ownerEmail: email,
      vehicleBrand: vehicleData.brand,
      vehicleModel: vehicleData.model,
      vehiclePlate: vehicleData.plate,
      tenantName: payload.tenantName.trim(),
      tenantPhone: payload.tenantPhone.trim(),
      tenantIdCardNumber: payload.tenantIdCardNumber.trim(),
      tenantIdCardPhotoUrl: payload.tenantIdCardPhotoUrl?.trim() || null,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalDays,
      dailyPrice,
      rentalAmount: amount,
      issuedAt: serverTimestamp() as unknown as Timestamp,
      createdAt: serverTimestamp() as unknown as Timestamp,
    };

    transaction.set(rentalRef, rentalPayload);
    transaction.set(receiptRef, receiptPayload);
    transaction.update(reservationRef, {
      status: "COMPLETED",
      updatedAt: serverTimestamp(),
      cancelledAt: null,
    });
    transaction.update(vehicleRef, {
      status: "rented",
      updatedAt: serverTimestamp(),
      activeReservationId: null,
      currentRentalId: rentalRef.id,
    });
  });
}

export async function completeRepairRequest(vehicleId: string): Promise<void> {
  const token = getTokenOrThrow();
  const response = await fetch(`${API_BASE_URL}/api/auth/vehicles/${vehicleId}/repairs/complete`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function listReservationsRequest(): Promise<ReservationApiResponse[]> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const snapshot = await getDocs(query(collection(db, "reservations"), where("ownerUid", "==", uid)));
  return snapshot.docs
    .map((docSnap) => mapReservationDoc(docSnap.id, docSnap.data() as ReservationFirestoreDoc))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function cancelReservationRequest(vehicleId: string): Promise<void> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const vehicleRef = doc(db, "vehicles", vehicleId);

  await runTransaction(db, async (transaction) => {
    const vehicleSnap = await transaction.get(vehicleRef);
    if (!vehicleSnap.exists()) {
      throw new Error("Vehicule introuvable.");
    }
    const vehicle = vehicleSnap.data() as VehicleFirestoreDoc;
    if (vehicle.ownerUid !== uid) {
      throw new Error("Acces refuse a ce vehicule.");
    }

    const reservationsSnap = await getDocs(
      query(
        collection(db, "reservations"),
        where("ownerUid", "==", uid),
        where("vehicleId", "==", vehicleId),
        where("status", "==", "ACTIVE"),
      ),
    );
    const activeReservationDoc = reservationsSnap.docs[0];
    if (!activeReservationDoc) {
      throw new Error("Aucune reservation active trouvee pour ce vehicule.");
    }
    const activeReservationRef = doc(db, "reservations", activeReservationDoc.id);
    transaction.update(activeReservationRef, {
      status: "CANCELLED",
      cancelledAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(vehicleRef, {
      status: "available",
      updatedAt: serverTimestamp(),
      activeReservationId: null,
    });
  });
}

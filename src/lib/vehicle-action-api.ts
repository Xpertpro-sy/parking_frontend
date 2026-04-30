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
} from "firebase/firestore";

export type CreateReservationPayload = {
  customerName: string;
  customerPhone: string;
  notes?: string;
  reservationDate: string;
  /** Dernier jour inclus de la fenêtre réservation (optionnel). Si absent, seul `reservationDate` compte. */
  reservationEndDate?: string;
  amountPaid: number;
};

export type CreateRepairPayload = {
  reason: string;
  cost: number;
  startDate: string;
  expectedEndDate?: string;
  garageName?: string;
  technicianName?: string;
  notes?: string;
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
  driver?: RentalDriverPayload;
};

type RentalDriverPayload = {
  fullName: string;
  phone: string;
};

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
  reservationEndDate: string | null;
  amountPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  cancelledAt: string | null;
  createdAt: string;
  createdByName: string;
};

export type RepairApiResponse = {
  id: string;
  vehicleId: string;
  ownerUid: string;
  reason: string;
  cost: number;
  startDate: string;
  expectedEndDate: string | null;
  garageName: string | null;
  technicianName: string | null;
  notes: string | null;
  status: "active" | "completed";
  completedAt: string | null;
  createdAt: string;
  createdByName: string;
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
  reservationEndDate?: string | null;
  amountPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  cancelledAt: string | null;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string | null;
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

type RepairFirestoreDoc = {
  vehicleId: string;
  ownerUid: string;
  ownerEmail: string | null;
  reason: string;
  cost: number;
  startDate: string;
  expectedEndDate: string | null;
  garageName: string | null;
  technicianName: string | null;
  notes: string | null;
  status: "active" | "completed";
  completedAt: string | null;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
    reservationEndDate: data.reservationEndDate ?? null,
    amountPaid: data.amountPaid,
    status: data.status,
    cancelledAt: data.cancelledAt,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    createdByName: data.createdByName && data.createdByName.trim().toLowerCase() !== "utilisateur" ? data.createdByName : "Utilisateur",
  };
}

function mapRepairDoc(id: string, data: RepairFirestoreDoc): RepairApiResponse {
  return {
    id,
    vehicleId: data.vehicleId,
    ownerUid: data.ownerUid,
    reason: data.reason,
    cost: data.cost,
    startDate: data.startDate,
    expectedEndDate: data.expectedEndDate,
    garageName: data.garageName,
    technicianName: data.technicianName,
    notes: data.notes,
    status: data.status,
    completedAt: data.completedAt,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    createdByName: data.createdByName && data.createdByName.trim().toLowerCase() !== "utilisateur" ? data.createdByName : "Utilisateur",
  };
}

export async function createReservationRequest(vehicleId: string, payload: CreateReservationPayload): Promise<void> {
  const db = getFirebaseDb();
  const { uid, email, actorUid, actorName } = await getAuthIdentity();

  if (!payload.customerName.trim() || !payload.customerPhone.trim()) {
    throw new Error("Nom et telephone du client sont obligatoires.");
  }
  if (!Number.isFinite(payload.amountPaid) || payload.amountPaid < 0) {
    throw new Error("Montant paye invalide.");
  }

  const reservationDateIso = parseReservationDate(payload.reservationDate);
  let reservationEndDateIso: string | null = null;
  if (payload.reservationEndDate?.trim()) {
    reservationEndDateIso = parseReservationDate(payload.reservationEndDate.trim());
    const startDay = new Date(reservationDateIso);
    const endDay = new Date(reservationEndDateIso);
    const startStamp = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate()).getTime();
    const endStamp = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate()).getTime();
    if (endStamp < startStamp) {
      throw new Error("La date de fin doit etre le meme jour ou apres le jour de reservation.");
    }
  }
  const vehicleRef = doc(db, "vehicles", vehicleId);
  const reservationRef = doc(collection(db, "reservations"));
  const movementRef = doc(collection(db, "accountMovements"));

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
      reservationEndDate: reservationEndDateIso,
      amountPaid: Number(payload.amountPaid),
      status: "ACTIVE",
      cancelledAt: null,
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(movementRef, {
      ownerUid: uid,
      ownerEmail: email,
      operationType: "reservation",
      direction: "entree",
      category: "Reservation",
      source: "caisse",
      reference: `RES-${reservationRef.id.slice(0, 8).toUpperCase()}`,
      amount: Number(payload.amountPaid),
      unitPrice: Number(payload.amountPaid),
      quantity: 1,
      operationDate: reservationDateIso,
      vehicleId,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      counterpartyName: payload.customerName.trim(),
      counterpartyPhone: payload.customerPhone.trim(),
      description: `Reservation vehicule ${vehicle.brand} ${vehicle.model}`,
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
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
  const db = getFirebaseDb();
  const { uid, email, actorUid, actorName } = await getAuthIdentity();
  const vehicleRef = doc(db, "vehicles", vehicleId);
  const repairRef = doc(collection(db, "repairs"));
  const movementRef = doc(collection(db, "accountMovements"));

  if (!payload.reason.trim()) {
    throw new Error("Le motif de reparation est obligatoire.");
  }
  if (!Number.isFinite(payload.cost) || payload.cost < 0) {
    throw new Error("Le cout de reparation est invalide.");
  }
  const parsedStartDate = parseDateTime(payload.startDate, "Date debut reparation");
  const parsedExpectedEndDate = payload.expectedEndDate
    ? parseDateTime(payload.expectedEndDate, "Date fin prevue")
    : null;
  if (parsedExpectedEndDate && parsedExpectedEndDate < parsedStartDate) {
    throw new Error("La date fin prevue doit etre apres la date debut.");
  }

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
      throw new Error("Seuls les vehicules disponibles peuvent etre envoyes en reparation.");
    }

    const repairPayload: RepairFirestoreDoc = {
      vehicleId,
      ownerUid: uid,
      ownerEmail: email,
      reason: payload.reason.trim(),
      cost: Number(payload.cost),
      startDate: parsedStartDate.toISOString(),
      expectedEndDate: parsedExpectedEndDate ? parsedExpectedEndDate.toISOString() : null,
      garageName: payload.garageName?.trim() || null,
      technicianName: payload.technicianName?.trim() || null,
      notes: payload.notes?.trim() || null,
      status: "active",
      completedAt: null,
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };

    transaction.set(repairRef, repairPayload);
    transaction.set(movementRef, {
      ownerUid: uid,
      ownerEmail: email,
      operationType: "repair",
      direction: "sortie",
      category: "Reparation",
      source: "caisse",
      reference: `REP-${repairRef.id.slice(0, 8).toUpperCase()}`,
      amount: Number(payload.cost),
      unitPrice: Number(payload.cost),
      quantity: 1,
      operationDate: parsedStartDate.toISOString(),
      vehicleId,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      counterpartyName: payload.garageName?.trim() || "Garage externe",
      counterpartyPhone: null,
      description: payload.reason.trim(),
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(vehicleRef, {
      status: "repair",
      updatedAt: serverTimestamp(),
      activeRepairId: repairRef.id,
    });
  });
}

export async function finalizeReservationToRentalRequest(
  vehicleId: string,
  payload: FinalizeReservationToRentalPayload,
): Promise<void> {
  const db = getFirebaseDb();
  const { uid, email, actorUid, actorName } = await getAuthIdentity();

  if (!payload.tenantIdCardNumber.trim()) {
    throw new Error("Le numero de piece du locataire est obligatoire.");
  }
  if (!payload.tenantName.trim() || !payload.tenantPhone.trim()) {
    throw new Error("Nom et telephone du locataire sont obligatoires.");
  }
  const driver = payload.driver;
  if (driver && (!driver.fullName.trim() || !driver.phone.trim())) {
    throw new Error("Le nom complet et le numero du chauffeur sont obligatoires.");
  }
  const startDate = parseDateTime(payload.startDate, "Date de debut");
  const endDate = parseDateTime(payload.endDate, "Date de fin");
  if (endDate <= startDate) {
    throw new Error("La date de fin doit etre apres la date de debut.");
  }

  const vehicleRef = doc(db, "vehicles", vehicleId);
  const rentalRef = doc(collection(db, "rentals"));
  const receiptRef = doc(collection(db, "rentalReceipts"));
  const movementRef = doc(collection(db, "accountMovements"));
  const driverRef = driver ? doc(collection(db, "drivers")) : null;

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
    const prepaidFromReservation = Math.max(0, Number(reservationData.amountPaid) || 0);
    const balanceDue = Math.max(0, amount - prepaidFromReservation);
    const receiptNumber = buildRentalReceiptNumber(endDate.toISOString(), rentalRef.id);
    const driverFullName = driver?.fullName.trim() || null;
    const driverPhone = driver?.phone.trim() || null;

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
      startMileage: Number(vehicleData.mileage) || 0,
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
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      issuedAt: serverTimestamp() as unknown as Timestamp,
      createdAt: serverTimestamp() as unknown as Timestamp,
    };

    transaction.set(rentalRef, rentalPayload);
    transaction.set(receiptRef, receiptPayload);
    if (driverRef && driverFullName && driverPhone) {
      transaction.set(driverRef, {
        ownerUid: uid,
        ownerEmail: email,
        fullName: driverFullName,
        phone: driverPhone,
        rentalId: rentalRef.id,
        vehicleId,
        vehicleBrand: vehicleData.brand,
        vehicleModel: vehicleData.model,
        vehiclePlate: vehicleData.plate,
        status: "assigned",
        createdByUid: actorUid,
        createdByName: actorName,
        createdByEmail: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    // L'acompte réservation est déjà comptabilisé (operationType "reservation") : on n'enregistre ici que le solde encaissé à la mise en location.
    if (balanceDue > 0) {
      const useDayBreakdown = prepaidFromReservation === 0;
      transaction.set(movementRef, {
        ownerUid: uid,
        ownerEmail: email,
        operationType: "rental",
        direction: "entree",
        category: "Location",
        source: "caisse",
        reference: receiptNumber,
        amount: balanceDue,
        unitPrice: useDayBreakdown ? dailyPrice : balanceDue,
        quantity: useDayBreakdown ? totalDays : 1,
        operationDate: startDate.toISOString(),
        vehicleId,
        vehicleBrand: vehicleData.brand,
        vehicleModel: vehicleData.model,
        vehiclePlate: vehicleData.plate,
        counterpartyName: payload.tenantName.trim(),
        counterpartyPhone: payload.tenantPhone.trim(),
        description: prepaidFromReservation
          ? `Solde location ${vehicleData.brand} ${vehicleData.model} (apres acompte reservation)`
          : `Location depuis reservation ${vehicleData.brand} ${vehicleData.model}`,
        createdByUid: actorUid,
        createdByName: actorName,
        createdByEmail: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
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
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const vehicleRef = doc(db, "vehicles", vehicleId);

  await runTransaction(db, async (transaction) => {
    const vehicleSnap = await transaction.get(vehicleRef);
    if (!vehicleSnap.exists()) {
      throw new Error("Vehicule introuvable.");
    }
    const vehicle = vehicleSnap.data() as VehicleFirestoreDoc & { activeRepairId?: string | null };
    if (vehicle.ownerUid !== uid) {
      throw new Error("Acces refuse a ce vehicule.");
    }
    if (vehicle.status !== "repair") {
      throw new Error("Ce vehicule n'est pas en reparation.");
    }

    const activeRepairId = vehicle.activeRepairId;
    if (!activeRepairId) {
      throw new Error("Aucune reparation active trouvee pour ce vehicule.");
    }

    const repairRef = doc(db, "repairs", activeRepairId);
    const repairSnap = await transaction.get(repairRef);
    if (!repairSnap.exists()) {
      throw new Error("Reparation introuvable.");
    }
    const repair = repairSnap.data() as RepairFirestoreDoc;
    if (repair.ownerUid !== uid || repair.status !== "active") {
      throw new Error("Reparation inactive ou inaccessible.");
    }

    transaction.update(repairRef, {
      status: "completed",
      completedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(vehicleRef, {
      status: "available",
      updatedAt: serverTimestamp(),
      activeRepairId: null,
    });
  });
}

export async function listReservationsRequest(): Promise<ReservationApiResponse[]> {
  const db = getFirebaseDb();
  const { uid, actorName } = await getAuthIdentity();
  const snapshot = await getDocs(query(collection(db, "reservations"), where("ownerUid", "==", uid)));
  return snapshot.docs
    .map((docSnap) => {
      const item = mapReservationDoc(docSnap.id, docSnap.data() as ReservationFirestoreDoc);
      if (!item.createdByName || item.createdByName.toLowerCase() === "utilisateur") {
        item.createdByName = actorName;
      }
      return item;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listRepairsRequest(): Promise<RepairApiResponse[]> {
  const db = getFirebaseDb();
  const { uid, actorName } = await getAuthIdentity();
  const snapshot = await getDocs(query(collection(db, "repairs"), where("ownerUid", "==", uid)));
  return snapshot.docs
    .map((docSnap) => {
      const item = mapRepairDoc(docSnap.id, docSnap.data() as RepairFirestoreDoc);
      if (!item.createdByName || item.createdByName.toLowerCase() === "utilisateur") {
        item.createdByName = actorName;
      }
      return item;
    })
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

import { getFirebaseDb, waitForFirebaseUser } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  Timestamp,
} from "firebase/firestore";

/** Clé React Query : invalider après vente, location, réservation, réparation. */
export const accountMovementsQueryKey = ["account", "movements", "list"] as const;

export type AccountMovementDirection = "entree" | "sortie";
export type AccountMovementSource = "caisse" | "banque" | "mobile-money" | "credit";
export type AccountMovementOperationType =
  | "sale"
  | "rental"
  | "reservation"
  | "repair"
  | "transfer"
  | "expense";

type AccountMovementFirestoreDoc = {
  ownerUid: string;
  ownerEmail: string | null;
  operationType: AccountMovementOperationType;
  direction: AccountMovementDirection;
  category: string;
  source: AccountMovementSource;
  reference: string;
  amount: number;
  unitPrice: number;
  quantity: number;
  operationDate: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  counterpartyName: string;
  counterpartyPhone: string | null;
  description: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type AccountMovementApiResponse = {
  id: string;
  ownerUid: string;
  operationType: AccountMovementOperationType;
  direction: AccountMovementDirection;
  category: string;
  source: AccountMovementSource;
  reference: string;
  amount: number;
  unitPrice: number;
  quantity: number;
  operationDate: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  counterpartyName: string;
  counterpartyPhone: string | null;
  description: string;
  createdAt: string;
};

async function getAuthIdentity() {
  const user = await waitForFirebaseUser();
  if (!user?.uid) {
    throw new Error("Session Firebase invalide. Veuillez vous reconnecter.");
  }
  return { uid: user.uid, email: user.email ?? null };
}

const MANUAL_MOVEMENT_VEHICLE = {
  vehicleId: "",
  vehicleBrand: "—",
  vehicleModel: "Operation manuelle",
  vehiclePlate: "—",
} as const;

function parseManualOperationDate(dateInput: string, fieldLabel: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    throw new Error(`${fieldLabel} invalide.`);
  }
  const parsed = new Date(`${dateInput}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} invalide.`);
  }
  return parsed.toISOString();
}

function mapMovementDoc(id: string, data: AccountMovementFirestoreDoc): AccountMovementApiResponse {
  return {
    id,
    ownerUid: data.ownerUid,
    operationType: data.operationType,
    direction: data.direction,
    category: data.category,
    source: data.source,
    reference: data.reference,
    amount: data.amount,
    unitPrice: data.unitPrice,
    quantity: data.quantity,
    operationDate: data.operationDate,
    vehicleId: data.vehicleId,
    vehicleBrand: data.vehicleBrand,
    vehicleModel: data.vehicleModel,
    vehiclePlate: data.vehiclePlate,
    counterpartyName: data.counterpartyName,
    counterpartyPhone: data.counterpartyPhone,
    description: data.description,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
  };
}

export async function listAccountMovementsRequest(): Promise<AccountMovementApiResponse[]> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const snapshot = await getDocs(query(collection(db, "accountMovements"), where("ownerUid", "==", uid)));
  return snapshot.docs
    .map((docSnap) => mapMovementDoc(docSnap.id, docSnap.data() as AccountMovementFirestoreDoc))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type CreateFundTransferPayload = {
  fromSource: AccountMovementSource;
  toSource: AccountMovementSource;
  amount: number;
  description: string;
  operationDate: string;
};

export type CreateManualExpensePayload = {
  source: AccountMovementSource;
  amount: number;
  description: string;
  operationDate: string;
};

/** Transfert entre deux sources (une sortie + une entree, meme reference). */
export async function createFundTransferRequest(payload: CreateFundTransferPayload): Promise<void> {
  const db = getFirebaseDb();
  const { uid, email } = await getAuthIdentity();

  if (payload.fromSource === payload.toSource) {
    throw new Error("La source et la destination doivent etre differentes.");
  }
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error("Montant invalide.");
  }
  const desc = payload.description.trim();
  if (!desc) {
    throw new Error("La description est obligatoire.");
  }

  const operationDateIso = parseManualOperationDate(payload.operationDate, "Date de l'operation");
  const outRef = doc(collection(db, "accountMovements"));
  const inRef = doc(collection(db, "accountMovements"));
  const reference = `TRF-${outRef.id.slice(0, 8).toUpperCase()}`;
  const amount = Number(payload.amount);

  await runTransaction(db, async (transaction) => {
    const base = {
      ownerUid: uid,
      ownerEmail: email,
      operationType: "transfer" as const,
      category: "Transfert de fonds",
      reference,
      amount,
      unitPrice: amount,
      quantity: 1,
      operationDate: operationDateIso,
      ...MANUAL_MOVEMENT_VEHICLE,
      counterpartyName: "Transfert interne",
      counterpartyPhone: null,
      description: desc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(outRef, {
      ...base,
      direction: "sortie",
      source: payload.fromSource,
    });
    transaction.set(inRef, {
      ...base,
      direction: "entree",
      source: payload.toSource,
    });
  });
}

/** Depense manuelle (sortie). */
export async function createManualExpenseRequest(payload: CreateManualExpensePayload): Promise<void> {
  const db = getFirebaseDb();
  const { uid, email } = await getAuthIdentity();

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error("Montant invalide.");
  }
  const desc = payload.description.trim();
  if (!desc) {
    throw new Error("Le motif est obligatoire.");
  }

  const operationDateIso = parseManualOperationDate(payload.operationDate, "Date de l'operation");
  const movementRef = doc(collection(db, "accountMovements"));
  const reference = `DEP-${movementRef.id.slice(0, 8).toUpperCase()}`;
  const amount = Number(payload.amount);

  await runTransaction(db, async (transaction) => {
    transaction.set(movementRef, {
      ownerUid: uid,
      ownerEmail: email,
      operationType: "expense",
      direction: "sortie",
      category: "Depense",
      source: payload.source,
      reference,
      amount,
      unitPrice: amount,
      quantity: 1,
      operationDate: operationDateIso,
      ...MANUAL_MOVEMENT_VEHICLE,
      counterpartyName: "Depense diverse",
      counterpartyPhone: null,
      description: desc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

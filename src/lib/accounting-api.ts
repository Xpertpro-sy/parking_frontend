import { getFirebaseDb, waitForFirebaseUser } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";

/** Clé React Query : invalider après vente, location, réservation, réparation. */
export const accountMovementsQueryKey = ["account", "movements", "list"] as const;

export type AccountMovementDirection = "entree" | "sortie";
export type AccountMovementSource = "caisse" | "banque" | "mobile-money" | "credit";
export type AccountMovementOperationType = "sale" | "rental" | "reservation" | "repair";

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
  return { uid: user.uid };
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

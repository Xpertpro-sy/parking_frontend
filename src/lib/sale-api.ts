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

export type CreateSalePayload = {
  vehicleId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  buyerAddress?: string;
  buyerIdCardNumber: string;
  paymentMethod: "cash" | "bank-transfer" | "mobile-money" | "cheque";
  amount: number;
  date?: string;
  notes?: string;
};

export type SaleApiResponse = {
  id: string;
  vehicleId: string;
  ownerUid: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string | null;
  buyerAddress: string;
  buyerIdCardNumber: string;
  paymentMethod: "cash" | "bank-transfer" | "mobile-money" | "cheque";
  amount: number;
  date: string;
  notes: string | null;
  createdAt: string;
  receipt: {
    id: string;
    receiptNumber: string;
  } | null;
};

export type ReceiptApiResponse = {
  id: string;
  receiptNumber: string;
  saleId: string;
  vehicleId: string;
  ownerUid: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string | null;
  buyerAddress: string;
  buyerIdCardNumber: string;
  paymentMethod: "cash" | "bank-transfer" | "mobile-money" | "cheque";
  amount: number;
  saleDate: string;
  notes: string | null;
  issuedAt: string;
  createdByName: string;
};

type SaleFirestoreDoc = {
  vehicleId: string;
  ownerUid: string;
  ownerEmail: string | null;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string | null;
  buyerAddress: string;
  buyerIdCardNumber: string;
  paymentMethod: "cash" | "bank-transfer" | "mobile-money" | "cheque";
  amount: number;
  date: string;
  notes: string;
  receiptId: string;
  receiptNumber: string;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type ReceiptFirestoreDoc = {
  saleId: string;
  vehicleId: string;
  ownerUid: string;
  ownerEmail: string | null;
  receiptNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string | null;
  buyerAddress: string;
  buyerIdCardNumber: string;
  paymentMethod: "cash" | "bank-transfer" | "mobile-money" | "cheque";
  amount: number;
  saleDate: string;
  notes: string;
  createdByUid?: string;
  createdByName?: string;
  createdByEmail?: string | null;
  issuedAt?: Timestamp;
  createdAt?: Timestamp;
};

function requirePositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant invalide.");
  }
}

async function getAuthIdentity() {
  const identity = await getWorkspaceIdentity();
  return {
    uid: identity.uid,
    email: identity.email,
    actorUid: identity.actorUid,
    actorName: identity.actorName,
  };
}

function formatDateValue(value?: string) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date de vente invalide.");
  }
  return parsed.toISOString();
}

function buildReceiptNumber(saleDateIso: string, saleId: string) {
  const saleDate = new Date(saleDateIso);
  const yyyy = saleDate.getFullYear();
  const mm = String(saleDate.getMonth() + 1).padStart(2, "0");
  const dd = String(saleDate.getDate()).padStart(2, "0");
  return `VTE-${yyyy}${mm}${dd}-${saleId.slice(0, 8).toUpperCase()}`;
}

function mapSaleDoc(id: string, data: SaleFirestoreDoc): SaleApiResponse {
  return {
    id,
    vehicleId: data.vehicleId,
    ownerUid: data.ownerUid,
    vehicleBrand: data.vehicleBrand,
    vehicleModel: data.vehicleModel,
    vehiclePlate: data.vehiclePlate,
    buyerName: data.buyerName,
    buyerPhone: data.buyerPhone,
    buyerEmail: data.buyerEmail ?? null,
    buyerAddress: data.buyerAddress,
    buyerIdCardNumber: data.buyerIdCardNumber,
    paymentMethod: data.paymentMethod,
    amount: data.amount,
    date: data.date,
    notes: data.notes || null,
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    receipt: data.receiptId
      ? {
          id: data.receiptId,
          receiptNumber: data.receiptNumber,
        }
      : null,
  };
}

function mapReceiptDoc(id: string, data: ReceiptFirestoreDoc): ReceiptApiResponse {
  return {
    id,
    receiptNumber: data.receiptNumber,
    saleId: data.saleId,
    vehicleId: data.vehicleId,
    ownerUid: data.ownerUid,
    vehicleBrand: data.vehicleBrand,
    vehicleModel: data.vehicleModel,
    vehiclePlate: data.vehiclePlate,
    buyerName: data.buyerName,
    buyerPhone: data.buyerPhone,
    buyerEmail: data.buyerEmail ?? null,
    buyerAddress: data.buyerAddress,
    buyerIdCardNumber: data.buyerIdCardNumber,
    paymentMethod: data.paymentMethod,
    amount: data.amount,
    saleDate: data.saleDate,
    notes: data.notes || null,
    issuedAt: data.issuedAt ? data.issuedAt.toDate().toISOString() : new Date().toISOString(),
    createdByName: data.createdByName && data.createdByName.trim().toLowerCase() !== "utilisateur" ? data.createdByName : "Utilisateur",
  };
}

function paymentMethodLabel(method: CreateSalePayload["paymentMethod"]) {
  switch (method) {
    case "cash":
      return "Especes";
    case "bank-transfer":
      return "Virement bancaire";
    case "mobile-money":
      return "Mobile Money";
    case "cheque":
      return "Cheque";
    default:
      return method;
  }
}

export function getPaymentMethodLabel(method: CreateSalePayload["paymentMethod"]) {
  return paymentMethodLabel(method);
}

export async function createSaleRequest(payload: CreateSalePayload): Promise<SaleApiResponse> {
  const db = getFirebaseDb();
  const { uid, email, actorUid, actorName } = await getAuthIdentity();

  if (!payload.buyerName.trim()) throw new Error("Le nom de l'acheteur est obligatoire.");
  if (!payload.buyerPhone.trim()) throw new Error("Le telephone de l'acheteur est obligatoire.");
  if (!payload.buyerIdCardNumber.trim()) throw new Error("Le numero de piece de l'acheteur est obligatoire.");
  requirePositiveAmount(payload.amount);

  const saleDateIso = formatDateValue(payload.date);
  const vehicleRef = doc(db, "vehicles", payload.vehicleId);
  const saleRef = doc(collection(db, "sales"));
  const receiptRef = doc(collection(db, "saleReceipts"));
  const movementRef = doc(collection(db, "accountMovements"));
  const receiptNumber = buildReceiptNumber(saleDateIso, saleRef.id);

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
      throw new Error("Seuls les vehicules disponibles peuvent etre vendus.");
    }

    const saleDoc: Omit<SaleFirestoreDoc, "createdAt" | "updatedAt"> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      vehicleId: payload.vehicleId,
      ownerUid: uid,
      ownerEmail: email,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      buyerName: payload.buyerName.trim(),
      buyerPhone: payload.buyerPhone.trim(),
      buyerEmail: payload.buyerEmail?.trim() || null,
      buyerAddress: (payload.buyerAddress ?? "").trim(),
      buyerIdCardNumber: payload.buyerIdCardNumber.trim(),
      paymentMethod: payload.paymentMethod,
      amount: Number(payload.amount),
      date: saleDateIso,
      notes: payload.notes?.trim() ?? "",
      receiptId: receiptRef.id,
      receiptNumber,
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const receiptDoc: Omit<ReceiptFirestoreDoc, "issuedAt" | "createdAt"> & {
      issuedAt: ReturnType<typeof serverTimestamp>;
      createdAt: ReturnType<typeof serverTimestamp>;
    } = {
      saleId: saleRef.id,
      vehicleId: payload.vehicleId,
      ownerUid: uid,
      ownerEmail: email,
      receiptNumber,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      buyerName: payload.buyerName.trim(),
      buyerPhone: payload.buyerPhone.trim(),
      buyerEmail: payload.buyerEmail?.trim() || null,
      buyerAddress: (payload.buyerAddress ?? "").trim(),
      buyerIdCardNumber: payload.buyerIdCardNumber.trim(),
      paymentMethod: payload.paymentMethod,
      amount: Number(payload.amount),
      saleDate: saleDateIso,
      notes: payload.notes?.trim() ?? "",
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      issuedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    transaction.set(saleRef, saleDoc);
    transaction.set(receiptRef, receiptDoc);
    transaction.set(movementRef, {
      ownerUid: uid,
      ownerEmail: email,
      operationType: "sale",
      direction: "entree",
      category: "Vente",
      source:
        payload.paymentMethod === "bank-transfer"
          ? "banque"
          : payload.paymentMethod === "mobile-money"
            ? "mobile-money"
            : payload.paymentMethod === "cheque"
              ? "banque"
              : "caisse",
      reference: receiptNumber,
      amount: Number(payload.amount),
      unitPrice: Number(payload.amount),
      quantity: 1,
      operationDate: saleDateIso,
      vehicleId: payload.vehicleId,
      vehicleBrand: vehicle.brand,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      counterpartyName: payload.buyerName.trim(),
      counterpartyPhone: payload.buyerPhone.trim(),
      description: `Vente vehicule ${vehicle.brand} ${vehicle.model}`,
      createdByUid: actorUid,
      createdByName: actorName,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(vehicleRef, {
      status: "sold",
      updatedAt: serverTimestamp(),
      soldAt: serverTimestamp(),
      soldPrice: Number(payload.amount),
      lastSaleId: saleRef.id,
    });
  });

  const createdSaleSnap = await getDoc(saleRef);
  const createdSaleData = createdSaleSnap.data() as SaleFirestoreDoc | undefined;
  if (!createdSaleData) {
    throw new Error("La vente a ete enregistree, mais la lecture a echoue.");
  }
  return mapSaleDoc(saleRef.id, createdSaleData);
}

export async function listSalesRequest(): Promise<SaleApiResponse[]> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const snapshot = await getDocs(query(collection(db, "sales"), where("ownerUid", "==", uid)));
  return snapshot.docs
    .map((docSnap) => mapSaleDoc(docSnap.id, docSnap.data() as SaleFirestoreDoc))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getReceiptBySaleIdRequest(saleId: string): Promise<ReceiptApiResponse | null> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const snapshot = await getDocs(query(collection(db, "saleReceipts"), where("saleId", "==", saleId), where("ownerUid", "==", uid)));
  const receiptDoc = snapshot.docs[0];
  if (!receiptDoc) {
    return null;
  }
  return mapReceiptDoc(receiptDoc.id, receiptDoc.data() as ReceiptFirestoreDoc);
}

export async function getReceiptByIdRequest(receiptId: string): Promise<ReceiptApiResponse | null> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const receiptRef = doc(db, "saleReceipts", receiptId);
  const receiptSnap = await getDoc(receiptRef);

  if (!receiptSnap.exists()) {
    return null;
  }

  const receiptData = receiptSnap.data() as ReceiptFirestoreDoc;
  if (receiptData.ownerUid !== uid) {
    return null;
  }

  return mapReceiptDoc(receiptSnap.id, receiptData);
}

export async function listReceiptsRequest(): Promise<ReceiptApiResponse[]> {
  const db = getFirebaseDb();
  const { uid, actorName } = await getAuthIdentity();
  const snapshot = await getDocs(query(collection(db, "saleReceipts"), where("ownerUid", "==", uid)));
  return snapshot.docs
    .map((docSnap) => {
      const item = mapReceiptDoc(docSnap.id, docSnap.data() as ReceiptFirestoreDoc);
      if (!item.createdByName || item.createdByName.toLowerCase() === "utilisateur") {
        item.createdByName = actorName;
      }
      return item;
    })
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
}

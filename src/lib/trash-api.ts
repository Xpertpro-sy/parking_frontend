import { getWorkspaceIdentity, type WorkspaceRole } from '@/lib/access-control';
import { getFirebaseDb } from '@/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  writeBatch,
  where,
  Timestamp,
} from 'firebase/firestore';

type TrashItemType = 'vehicle' | 'receipt-sale' | 'receipt-rental' | 'history-reservation' | 'history-rental';

type TrashSourceCollection = 'vehicles' | 'saleReceipts' | 'rentalReceipts' | 'reservations' | 'rentals';

type TrashItemFirestoreDoc = {
  ownerUid: string;
  ownerEmail: string | null;
  itemType: TrashItemType;
  sourceCollection: TrashSourceCollection;
  sourceId: string;
  title: string;
  subtitle: string | null;
  amount: number | null;
  payload: Record<string, unknown>;
  deletedByUid?: string;
  deletedByName?: string;
  deletedByEmail?: string | null;
  deletedAt?: Timestamp;
  createdAt?: Timestamp;
};

export type TrashItemApiResponse = {
  id: string;
  itemType: TrashItemType;
  sourceCollection: TrashSourceCollection;
  sourceId: string;
  title: string;
  subtitle: string | null;
  amount: number | null;
  deletedAt: string;
  deletedByName: string;
};

export const trashItemsQueryKey = ['trash', 'items', 'list'] as const;

async function getAuthIdentity() {
  const identity = await getWorkspaceIdentity();
  return {
    uid: identity.uid,
    email: identity.email,
    actorUid: identity.actorUid,
    actorName: identity.actorName,
    role: identity.role,
  };
}

function assertAdminCanPermanentlyDelete(role: WorkspaceRole) {
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Seul l'administrateur peut supprimer définitivement dans la corbeille.");
  }
}

async function moveDocumentToTrash(params: {
  sourceCollection: TrashSourceCollection;
  sourceId: string;
  itemType: TrashItemType;
  title: string;
  subtitle?: string | null;
  amount?: number | null;
}): Promise<void> {
  const db = getFirebaseDb();
  const { uid, email, actorUid, actorName } = await getAuthIdentity();
  const sourceRef = doc(db, params.sourceCollection, params.sourceId);
  const sourceSnap = await getDoc(sourceRef);
  if (!sourceSnap.exists()) throw new Error("Element introuvable.");

  const sourceData = sourceSnap.data() as { ownerUid?: string };
  if (sourceData.ownerUid !== uid) throw new Error('Acces refuse.');

  const trashRef = doc(collection(db, 'trashItems'));
  await setDoc(trashRef, {
    ownerUid: uid,
    ownerEmail: email,
    itemType: params.itemType,
    sourceCollection: params.sourceCollection,
    sourceId: params.sourceId,
    title: params.title,
    subtitle: params.subtitle ?? null,
    amount: params.amount ?? null,
    payload: sourceSnap.data(),
    deletedByUid: actorUid,
    deletedByName: actorName,
    deletedByEmail: email,
    deletedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  await deleteDoc(sourceRef);
}

export async function moveVehicleToTrashRequest(vehicleId: string): Promise<void> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'vehicles', vehicleId));
  if (!snap.exists()) throw new Error('Vehicule introuvable.');
  const d = snap.data() as { brand: string; model: string; plate: string; salePrice?: number };
  await moveDocumentToTrash({
    sourceCollection: 'vehicles',
    sourceId: vehicleId,
    itemType: 'vehicle',
    title: `${d.brand} ${d.model}`,
    subtitle: d.plate,
    amount: Number.isFinite(d.salePrice) ? Number(d.salePrice) : null,
  });
}

export async function moveSaleReceiptToTrashRequest(receiptId: string): Promise<void> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'saleReceipts', receiptId));
  if (!snap.exists()) throw new Error('Recu de vente introuvable.');
  const d = snap.data() as { receiptNumber: string; vehicleBrand: string; vehicleModel: string; amount: number };
  await moveDocumentToTrash({
    sourceCollection: 'saleReceipts',
    sourceId: receiptId,
    itemType: 'receipt-sale',
    title: d.receiptNumber,
    subtitle: `${d.vehicleBrand} ${d.vehicleModel}`,
    amount: Number(d.amount),
  });
}

export async function moveRentalReceiptToTrashRequest(receiptId: string): Promise<void> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'rentalReceipts', receiptId));
  if (!snap.exists()) throw new Error('Recu de location introuvable.');
  const d = snap.data() as { receiptNumber: string; vehicleBrand: string; vehicleModel: string; rentalAmount: number };
  await moveDocumentToTrash({
    sourceCollection: 'rentalReceipts',
    sourceId: receiptId,
    itemType: 'receipt-rental',
    title: d.receiptNumber,
    subtitle: `${d.vehicleBrand} ${d.vehicleModel}`,
    amount: Number(d.rentalAmount),
  });
}

export async function moveReservationHistoryToTrashRequest(reservationId: string): Promise<void> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'reservations', reservationId));
  if (!snap.exists()) throw new Error('Reservation introuvable.');
  const d = snap.data() as { customerName: string; vehicleBrand: string; vehicleModel: string; amountPaid: number };
  await moveDocumentToTrash({
    sourceCollection: 'reservations',
    sourceId: reservationId,
    itemType: 'history-reservation',
    title: `Reservation ${d.customerName}`,
    subtitle: `${d.vehicleBrand} ${d.vehicleModel}`,
    amount: Number(d.amountPaid),
  });
}

export async function moveRentalHistoryToTrashRequest(rentalId: string): Promise<void> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'rentals', rentalId));
  if (!snap.exists()) throw new Error('Location introuvable.');
  const d = snap.data() as { tenantName: string; vehicleBrand: string; vehicleModel: string; amount: number };
  await moveDocumentToTrash({
    sourceCollection: 'rentals',
    sourceId: rentalId,
    itemType: 'history-rental',
    title: `Location ${d.tenantName}`,
    subtitle: `${d.vehicleBrand} ${d.vehicleModel}`,
    amount: Number(d.amount),
  });
}

export async function listTrashItemsRequest(): Promise<TrashItemApiResponse[]> {
  const db = getFirebaseDb();
  const { uid, actorName } = await getAuthIdentity();
  const snap = await getDocs(query(collection(db, 'trashItems'), where('ownerUid', '==', uid)));
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as TrashItemFirestoreDoc;
      return {
        id: docSnap.id,
        itemType: data.itemType,
        sourceCollection: data.sourceCollection,
        sourceId: data.sourceId,
        title: data.title,
        subtitle: data.subtitle ?? null,
        amount: data.amount ?? null,
        deletedAt: data.deletedAt ? data.deletedAt.toDate().toISOString() : new Date().toISOString(),
        deletedByName:
          data.deletedByName && data.deletedByName.trim().toLowerCase() !== "utilisateur"
            ? data.deletedByName
            : actorName,
      };
    })
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

export async function deleteTrashItemPermanentlyRequest(trashItemId: string): Promise<void> {
  const db = getFirebaseDb();
  const { uid, role } = await getAuthIdentity();
  assertAdminCanPermanentlyDelete(role);
  const trashRef = doc(db, 'trashItems', trashItemId);
  const trashSnap = await getDoc(trashRef);
  if (!trashSnap.exists()) throw new Error('Element de corbeille introuvable.');
  const data = trashSnap.data() as TrashItemFirestoreDoc;
  if (data.ownerUid !== uid) throw new Error('Acces refuse.');
  await deleteDoc(trashRef);
}

export async function restoreTrashItemRequest(trashItemId: string): Promise<void> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const trashRef = doc(db, 'trashItems', trashItemId);
  const trashSnap = await getDoc(trashRef);
  if (!trashSnap.exists()) throw new Error('Element de corbeille introuvable.');
  const data = trashSnap.data() as TrashItemFirestoreDoc;
  if (data.ownerUid !== uid) throw new Error('Acces refuse.');

  const sourceRef = doc(db, data.sourceCollection, data.sourceId);
  await setDoc(sourceRef, data.payload as Record<string, unknown>);
  await deleteDoc(trashRef);
}

export async function deleteSelectedTrashItemsPermanentlyRequest(trashItemIds: string[]): Promise<void> {
  if (trashItemIds.length === 0) return;
  const db = getFirebaseDb();
  const { uid, role } = await getAuthIdentity();
  assertAdminCanPermanentlyDelete(role);
  const batch = writeBatch(db);
  for (const id of trashItemIds) {
    const ref = doc(db, 'trashItems', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    const data = snap.data() as TrashItemFirestoreDoc;
    if (data.ownerUid !== uid) continue;
    batch.delete(ref);
  }
  await batch.commit();
}

export async function restoreSelectedTrashItemsRequest(trashItemIds: string[]): Promise<void> {
  if (trashItemIds.length === 0) return;
  for (const id of trashItemIds) {
    await restoreTrashItemRequest(id);
  }
}

export async function emptyTrashRequest(): Promise<void> {
  const { role } = await getAuthIdentity();
  assertAdminCanPermanentlyDelete(role);
  const items = await listTrashItemsRequest();
  await deleteSelectedTrashItemsPermanentlyRequest(items.map((item) => item.id));
}

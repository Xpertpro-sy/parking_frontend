import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getWorkspaceIdentity } from "@/lib/access-control";
import {
  addCalendarMonths,
  getSubscriptionPlan,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";

export type SubscriptionRequestStatus = "pending" | "approved" | "rejected";

export type SubscriptionRequestRow = {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  ownerDisplayName: string;
  planId: string;
  amountCfa: number;
  depositReference: string;
  status: SubscriptionRequestStatus;
  createdAt: string;
  updatedAt: string | null;
  reviewedAt: string | null;
  reviewedByUid: string | null;
  rejectReason: string | null;
};

export type TenantSubscriptionRow = {
  ownerUid: string;
  planId: string;
  expiresAt: string;
  updatedAt: string | null;
  lastApprovedRequestId: string | null;
};

export type TenantSubscriptionState = {
  subscription: TenantSubscriptionRow | null;
  /** Abonnement actif : date de fin dans le futur. */
  isActive: boolean;
  expiresAtLabel: string | null;
  planLabel: string | null;
};

function assertSuperAdmin(role: string | undefined) {
  if (role !== "SUPER_ADMIN") throw new Error("Accès réservé au super administrateur.");
}

function assertTenantAdmin(role: string | undefined) {
  if (role !== "ADMIN") throw new Error("Seul l'administrateur de l'entreprise peut souscrire ou renouveler.");
}

function tsToIso(t: Timestamp | undefined | null): string | null {
  if (!t?.toDate) return null;
  try {
    return t.toDate().toISOString();
  } catch {
    return null;
  }
}

const COL_REQUESTS = "subscriptionRequests";
const COL_TENANT_SUBS = "tenantSubscriptions";

export const tenantSubscriptionStateQueryKey = (ownerUid: string) =>
  ["subscription", "tenant-state", ownerUid] as const;

export const tenantSubscriptionRequestsQueryKey = (ownerUid: string) =>
  ["subscription", "requests", ownerUid] as const;

export const superAdminSubscriptionsOverviewQueryKey = ["super-admin", "subscriptions-overview"] as const;

export const superAdminPendingSubscriptionsQueryKey = ["super-admin", "subscription-pending-count"] as const;

export async function getTenantSubscriptionStateRequest(ownerUid: string): Promise<TenantSubscriptionState> {
  const identity = await getWorkspaceIdentity();
  if (identity.role !== "SUPER_ADMIN" && identity.uid !== ownerUid) {
    throw new Error("Accès refusé.");
  }
  const db = getFirebaseDb();
  const subSnap = await getDoc(doc(db, COL_TENANT_SUBS, ownerUid));
  if (!subSnap.exists()) {
    return {
      subscription: null,
      isActive: false,
      expiresAtLabel: null,
      planLabel: null,
    };
  }
  const d = subSnap.data() as {
    planId?: string;
    expiresAt?: Timestamp;
    updatedAt?: Timestamp;
    lastApprovedRequestId?: string | null;
  };
  const expiresAt = d.expiresAt;
  const expiresDate = expiresAt?.toDate?.() ?? null;
  const isActive = Boolean(expiresDate && expiresDate.getTime() > Date.now());
  const plan = d.planId ? getSubscriptionPlan(d.planId) : undefined;
  const row: TenantSubscriptionRow = {
    ownerUid,
    planId: d.planId ?? "",
    expiresAt: expiresDate ? expiresDate.toISOString() : "",
    updatedAt: tsToIso(d.updatedAt),
    lastApprovedRequestId: d.lastApprovedRequestId ?? null,
  };
  return {
    subscription: row,
    isActive,
    expiresAtLabel: expiresDate ? expiresDate.toLocaleDateString("fr-FR", { dateStyle: "long" }) : null,
    planLabel: plan?.label ?? d.planId ?? null,
  };
}

export async function listTenantSubscriptionRequestsRequest(ownerUid: string): Promise<SubscriptionRequestRow[]> {
  const identity = await getWorkspaceIdentity();
  if (identity.role !== "SUPER_ADMIN" && identity.uid !== ownerUid) {
    throw new Error("Accès refusé.");
  }

  const db = getFirebaseDb();
  const q = query(
    collection(db, COL_REQUESTS),
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((x) => mapRequestDoc(x.id, x.data()));
}

function mapRequestDoc(id: string, d: Record<string, unknown>): SubscriptionRequestRow {
  return {
    id,
    ownerUid: String(d.ownerUid ?? ""),
    ownerEmail: String(d.ownerEmail ?? ""),
    ownerDisplayName: String(d.ownerDisplayName ?? ""),
    planId: String(d.planId ?? ""),
    amountCfa: typeof d.amountCfa === "number" ? d.amountCfa : 0,
    depositReference: String(d.depositReference ?? ""),
    status: (d.status as SubscriptionRequestStatus) ?? "pending",
    createdAt: tsToIso(d.createdAt as Timestamp) ?? "",
    updatedAt: tsToIso(d.updatedAt as Timestamp | undefined),
    reviewedAt: tsToIso(d.reviewedAt as Timestamp | undefined),
    reviewedByUid: d.reviewedByUid != null ? String(d.reviewedByUid) : null,
    rejectReason: d.rejectReason != null ? String(d.rejectReason) : null,
  };
}

export async function submitSubscriptionRequestRequest(params: {
  planId: SubscriptionPlanId;
  depositReference: string;
}): Promise<void> {
  const identity = await getWorkspaceIdentity();
  assertTenantAdmin(identity.role);
  const plan = getSubscriptionPlan(params.planId);
  if (!plan) throw new Error("Formule invalide.");

  const ref = params.depositReference.trim();
  if (ref.length < 4) throw new Error("L'ID de dépôt doit contenir au moins 4 caractères.");

  const db = getFirebaseDb();
  const ownerUid = identity.uid;

  const pendingSnap = await getDocs(
    query(
      collection(db, COL_REQUESTS),
      where("ownerUid", "==", ownerUid),
      where("status", "==", "pending"),
    ),
  );
  if (!pendingSnap.empty) {
    throw new Error("Vous avez déjà une demande en attente de vérification. Attendez le traitement ou contactez le support.");
  }

  await addDoc(collection(db, COL_REQUESTS), {
    ownerUid,
    ownerEmail: identity.email ?? "",
    ownerDisplayName: identity.actorName ?? "",
    planId: plan.id,
    amountCfa: plan.priceCfa,
    depositReference: ref,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export type SuperAdminSubscriptionsOverview = {
  pending: SubscriptionRequestRow[];
  requests: SubscriptionRequestRow[];
  tenantSubscriptions: TenantSubscriptionRow[];
};

export async function getSuperAdminSubscriptionsOverviewRequest(): Promise<SuperAdminSubscriptionsOverview> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdmin(identity.role);
  const db = getFirebaseDb();

  const [reqSnap, subSnap] = await Promise.all([
    getDocs(query(collection(db, COL_REQUESTS), orderBy("createdAt", "desc"))),
    getDocs(collection(db, COL_TENANT_SUBS)),
  ]);

  const requests = reqSnap.docs.map((x) => mapRequestDoc(x.id, x.data()));
  const pending = requests.filter((r) => r.status === "pending");

  const tenantSubscriptions: TenantSubscriptionRow[] = subSnap.docs.map((x) => {
    const d = x.data() as {
      planId?: string;
      expiresAt?: Timestamp;
      updatedAt?: Timestamp;
      lastApprovedRequestId?: string | null;
    };
    const exp = d.expiresAt?.toDate?.();
    return {
      ownerUid: x.id,
      planId: d.planId ?? "",
      expiresAt: exp ? exp.toISOString() : "",
      updatedAt: tsToIso(d.updatedAt),
      lastApprovedRequestId: d.lastApprovedRequestId ?? null,
    };
  });

  return { pending, requests, tenantSubscriptions };
}

export async function approveSubscriptionRequestSuperAdminRequest(requestId: string): Promise<void> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdmin(identity.role);
  const db = getFirebaseDb();
  const reqRef = doc(db, COL_REQUESTS, requestId);

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Demande introuvable.");
    const r = reqSnap.data() as {
      status?: string;
      ownerUid?: string;
      planId?: string;
      amountCfa?: number;
      depositReference?: string;
      createdAt?: Timestamp;
    };
    if (r.status !== "pending") throw new Error("Cette demande a déjà été traitée.");

    const ownerUid = r.ownerUid;
    const planId = r.planId;
    if (!ownerUid || !planId) throw new Error("Données de demande incomplètes.");

    const plan = getSubscriptionPlan(planId);
    if (!plan) throw new Error("Formule inconnue.");

    const subRef = doc(db, COL_TENANT_SUBS, ownerUid);
    const subSnap = await tx.get(subRef);
    const now = new Date();
    let base = now;
    if (subSnap.exists()) {
      const prev = subSnap.data() as { expiresAt?: Timestamp };
      const prevExp = prev.expiresAt?.toDate?.();
      if (prevExp && prevExp.getTime() > now.getTime()) {
        base = prevExp;
      }
    }
    const newExpires = addCalendarMonths(base, plan.durationMonths);

    tx.update(reqRef, {
      status: "approved",
      updatedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
      reviewedByUid: identity.actorUid,
      rejectReason: null,
    });

    tx.set(
      subRef,
      {
        ownerUid,
        planId: plan.id,
        expiresAt: newExpires,
        updatedAt: serverTimestamp(),
        lastApprovedRequestId: requestId,
      },
      { merge: true },
    );
  });
}

export async function rejectSubscriptionRequestSuperAdminRequest(
  requestId: string,
  rejectReason?: string,
): Promise<void> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdmin(identity.role);
  const db = getFirebaseDb();
  const reqRef = doc(db, COL_REQUESTS, requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error("Demande introuvable.");
  const r = snap.data() as { status?: string };
  if (r.status !== "pending") throw new Error("Cette demande a déjà été traitée.");

  await updateDoc(reqRef, {
    status: "rejected",
    updatedAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
    reviewedByUid: identity.actorUid,
    rejectReason: (rejectReason ?? "").trim() || "Non conforme",
  });
}

export async function countPendingSubscriptionRequestsSuperAdminRequest(): Promise<number> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdmin(identity.role);
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, COL_REQUESTS), where("status", "==", "pending")));
  return snap.size;
}

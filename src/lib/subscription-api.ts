import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
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
  TRIAL_SUBSCRIPTION_PLAN,
  addCalendarMonths,
  formatCumulativeSubscriptionLabel,
  formatSubscriptionTimeRemaining,
  formatTrialExpiryDisplay,
  getSubscriptionPlan,
  getTrialExpiresAt,
  getTrialPlanLabel,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import {
  LIFETIME_MAX_MANAGERS_PER_TENANT_ADMIN,
  TENANT_ADMIN_LIMITS_COLLECTION,
} from "@/lib/tenant-admin-manager-limit";

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
  isLifetime?: boolean;
  /** Somme des formules validées (affichage back-office). */
  cumulativePlanLabel?: string | null;
};

export type TenantSubscriptionState = {
  subscription: TenantSubscriptionRow | null;
  /** Abonnement actif : date de fin dans le futur. */
  isActive: boolean;
  expiresAtLabel: string | null;
  planLabel: string | null;
  /** Essai déduit de la date d’inscription (pas de document Firestore `tenantSubscriptions`). */
  isImplicitTrial?: boolean;
  isLifetime?: boolean;
};

export type SubscriptionDaySummary = {
  headline: string;
  subline: string;
  variant: "default" | "success" | "warning" | "destructive";
};

/** Résumé lisible pour le super admin (état au jour le jour). */
export function buildSubscriptionDaySummary(
  state: TenantSubscriptionState,
  accountCreatedAt: Date | null,
  hasPendingRequest: boolean,
): SubscriptionDaySummary {
  const now = new Date();
  const pending =
    hasPendingRequest ? "Une demande de souscription est en attente de vérification (sous 24 h)." : "";

  if (state.isLifetime || state.subscription?.isLifetime) {
    return {
      headline: `${state.planLabel ?? "À vie"} — actif`,
      subline: [pending, "Paiement unique validé. L’abonnement n’expire pas."]
        .filter(Boolean)
        .join(" ")
        .trim(),
      variant: hasPendingRequest ? "warning" : "success",
    };
  }

  if (state.subscription?.expiresAt) {
    const exp = new Date(state.subscription.expiresAt);
    const label = state.planLabel ?? state.subscription.planId;
    const dateStr = formatTrialExpiryDisplay(exp);
    if (exp.getTime() > now.getTime()) {
      const remaining = formatSubscriptionTimeRemaining(now, exp);
      return {
        headline: `${label} — actif`,
        subline: [pending, `Expire le ${dateStr} · il reste ${remaining}.`]
          .filter(Boolean)
          .join(" ")
          .trim(),
        variant: hasPendingRequest ? "warning" : "success",
      };
    }
    return {
      headline: `${label} — expiré`,
      subline: [pending, `Échéance dépassée depuis le ${dateStr}.`].filter(Boolean).join(" ").trim(),
      variant: "destructive",
    };
  }

  if (accountCreatedAt) {
    const trialEnd = getTrialExpiresAt(accountCreatedAt);
    const endLabel = formatTrialExpiryDisplay(trialEnd);
    if (trialEnd.getTime() > now.getTime()) {
      const remaining = formatSubscriptionTimeRemaining(now, trialEnd);
      return {
        headline: `${getTrialPlanLabel()} — actif (sans fiche Firestore)`,
        subline: [pending, `Période gratuite déduite de l’inscription jusqu’au ${endLabel} · il reste ${remaining}.`]
          .filter(Boolean)
          .join(" ")
          .trim(),
        variant: hasPendingRequest ? "warning" : "success",
      };
    }
    return {
      headline: "Essai gratuit terminé",
      subline: [
        pending,
        `L’essai après inscription est clos depuis le ${endLabel}. Aucun abonnement payant actif.`,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
      variant: "destructive",
    };
  }

  return {
    headline: "Aucun abonnement actif",
    subline: pending || "Aucune formule ni essai n’est enregistré pour ce compte.",
    variant: hasPendingRequest ? "warning" : "default",
  };
}

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
const LIFETIME_EXPIRES_AT = new Date("9999-12-31T23:59:59.999Z");

/** Somme des `durationMonths` des demandes validées (prolongations cumulées). */
async function sumApprovedSubscriptionMonths(db: ReturnType<typeof getFirebaseDb>, ownerUid: string): Promise<number> {
  const snap = await getDocs(query(collection(db, COL_REQUESTS), where("ownerUid", "==", ownerUid)));
  let sum = 0;
  for (const docSnap of snap.docs) {
    const d = docSnap.data() as { status?: string; planId?: string };
    if (d.status !== "approved") continue;
    const p = getSubscriptionPlan(d.planId ?? "");
    sum += p?.durationMonths ?? 0;
  }
  return sum;
}

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

  const canReadOwnerSignupDate =
    identity.role === "SUPER_ADMIN" || identity.uid === ownerUid;

  const subSnap = await getDoc(doc(db, COL_TENANT_SUBS, ownerUid));
  if (!subSnap.exists()) {
    if (!canReadOwnerSignupDate) {
      return {
        subscription: null,
        isActive: false,
        expiresAtLabel: null,
        planLabel: null,
        isImplicitTrial: false,
      };
    }
    const userSnap = await getDoc(doc(db, "users", ownerUid));
    const createdRaw = userSnap.exists()
      ? (userSnap.data() as { createdAt?: Timestamp }).createdAt
      : undefined;
    const createdDate = createdRaw?.toDate?.() ?? null;
    if (!createdDate) {
      return {
        subscription: null,
        isActive: false,
        expiresAtLabel: null,
        planLabel: null,
        isImplicitTrial: false,
      };
    }
    const virtualEnd = getTrialExpiresAt(createdDate);
    if (virtualEnd.getTime() > Date.now()) {
      return {
        subscription: {
          ownerUid,
          planId: TRIAL_SUBSCRIPTION_PLAN.id,
          expiresAt: virtualEnd.toISOString(),
          updatedAt: null,
          lastApprovedRequestId: null,
        },
        isActive: true,
        expiresAtLabel: formatTrialExpiryDisplay(virtualEnd),
        planLabel: getTrialPlanLabel(),
        isImplicitTrial: true,
      };
    }
    return {
      subscription: null,
      isActive: false,
      expiresAtLabel: null,
      planLabel: null,
      isImplicitTrial: false,
    };
  }
  const d = subSnap.data() as {
    planId?: string;
    expiresAt?: Timestamp;
    updatedAt?: Timestamp;
    lastApprovedRequestId?: string | null;
    isLifetime?: boolean;
  };
  const expiresAt = d.expiresAt;
  const expiresDate = expiresAt?.toDate?.() ?? null;
  const isLifetime = d.isLifetime === true || d.planId === "lifetime";
  const isActive = isLifetime || Boolean(expiresDate && expiresDate.getTime() > Date.now());
  const plan = d.planId ? getSubscriptionPlan(d.planId) : undefined;
  const row: TenantSubscriptionRow = {
    ownerUid,
    planId: d.planId ?? "",
    expiresAt: expiresDate ? expiresDate.toISOString() : "",
    updatedAt: tsToIso(d.updatedAt),
    lastApprovedRequestId: d.lastApprovedRequestId ?? null,
    isLifetime,
  };

  let planLabel: string | null = plan?.label ?? d.planId ?? null;
  const paidPlanId = d.planId ?? "";
  if (!isLifetime && paidPlanId !== "" && paidPlanId !== TRIAL_SUBSCRIPTION_PLAN.id) {
    const approvedMonthsSum = await sumApprovedSubscriptionMonths(db, ownerUid);
    if (approvedMonthsSum > 0) {
      planLabel = formatCumulativeSubscriptionLabel(approvedMonthsSum);
    }
  }

  return {
    subscription: row,
    isActive,
    expiresAtLabel: isLifetime ? "À vie" : expiresDate ? formatTrialExpiryDisplay(expiresDate) : null,
    planLabel,
    isImplicitTrial: false,
    isLifetime,
  };
}

export async function listTenantSubscriptionRequestsRequest(ownerUid: string): Promise<SubscriptionRequestRow[]> {
  const identity = await getWorkspaceIdentity();
  if (identity.role !== "SUPER_ADMIN" && identity.uid !== ownerUid) {
    throw new Error("Accès refusé.");
  }

  const db = getFirebaseDb();
  // Pas d’orderBy Firestore : évite l’index composite ownerUid + createdAt (tri en mémoire, volume faible).
  const q = query(collection(db, COL_REQUESTS), where("ownerUid", "==", ownerUid));
  const snap = await getDocs(q);
  const rows = snap.docs.map((x) => mapRequestDoc(x.id, x.data()));
  rows.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  return rows;
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

  const approvedMonthsByOwner = new Map<string, number>();
  for (const r of requests) {
    if (r.status !== "approved") continue;
    const p = getSubscriptionPlan(r.planId);
    approvedMonthsByOwner.set(r.ownerUid, (approvedMonthsByOwner.get(r.ownerUid) ?? 0) + (p?.durationMonths ?? 0));
  }

  const tenantSubscriptions: TenantSubscriptionRow[] = subSnap.docs.map((x) => {
    const d = x.data() as {
      planId?: string;
      expiresAt?: Timestamp;
      updatedAt?: Timestamp;
      lastApprovedRequestId?: string | null;
      isLifetime?: boolean;
    };
    const exp = d.expiresAt?.toDate?.();
    const approvedSum = approvedMonthsByOwner.get(x.id) ?? 0;
    const isLifetime = d.isLifetime === true || d.planId === "lifetime";
    return {
      ownerUid: x.id,
      planId: d.planId ?? "",
      expiresAt: exp ? exp.toISOString() : "",
      updatedAt: tsToIso(d.updatedAt),
      lastApprovedRequestId: d.lastApprovedRequestId ?? null,
      isLifetime,
      cumulativePlanLabel: isLifetime ? "À vie" : approvedSum > 0 ? formatCumulativeSubscriptionLabel(approvedSum) : null,
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
    let alreadyLifetime = false;
    if (subSnap.exists()) {
      const prev = subSnap.data() as { expiresAt?: Timestamp; isLifetime?: boolean; planId?: string };
      alreadyLifetime = prev.isLifetime === true || prev.planId === "lifetime";
      const prevExp = prev.expiresAt?.toDate?.();
      if (prevExp && prevExp.getTime() > now.getTime()) {
        base = prevExp;
      }
    }
    const isLifetimePlan = plan.isLifetime === true || plan.id === "lifetime";
    const shouldBeLifetime = alreadyLifetime || isLifetimePlan;
    const newExpires = shouldBeLifetime ? LIFETIME_EXPIRES_AT : addCalendarMonths(base, plan.durationMonths);

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
        planId: shouldBeLifetime ? "lifetime" : plan.id,
        expiresAt: newExpires,
        isLifetime: shouldBeLifetime,
        updatedAt: serverTimestamp(),
        lastApprovedRequestId: requestId,
      },
      { merge: true },
    );

    if (isLifetimePlan) {
      tx.set(
        doc(db, TENANT_ADMIN_LIMITS_COLLECTION, ownerUid),
        {
          ownerUid,
          maxManagers: LIFETIME_MAX_MANAGERS_PER_TENANT_ADMIN,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
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

export async function hasPendingSubscriptionRequestSuperAdminRequest(ownerUid: string): Promise<boolean> {
  const identity = await getWorkspaceIdentity();
  assertSuperAdmin(identity.role);
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(
      collection(db, COL_REQUESTS),
      where("ownerUid", "==", ownerUid),
      where("status", "==", "pending"),
      limit(1),
    ),
  );
  return !snap.empty;
}

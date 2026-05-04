export type SubscriptionPlanId = "1m" | "3m" | "6m" | "1y" | "lifetime";

/** Identifiant stocké en base pour l’essai gratuit (hors formules payantes). */
export const TRIAL_SUBSCRIPTION_PLAN_ID = "trial" as const;

export type SubscriptionPlanDef = {
  id: SubscriptionPlanId | typeof TRIAL_SUBSCRIPTION_PLAN_ID;
  label: string;
  durationMonths: number;
  priceCfa: number;
  isLifetime?: boolean;
};

/** Formule payante (sélection Orange Money) — `id` sans `trial`. */
export type PaidSubscriptionPlanDef = {
  id: SubscriptionPlanId;
  label: string;
  durationMonths: number;
  priceCfa: number;
  isLifetime?: boolean;
};

/** Numéro affiché pour les dépôts Orange Money (Mali). */
export const ORANGE_MONEY_PHONE_DISPLAY = "+223 78 71 16 23";

/** Essai gratuit après création du compte administrateur (non proposé comme achat). */
export const TRIAL_SUBSCRIPTION_PLAN: SubscriptionPlanDef = {
  id: TRIAL_SUBSCRIPTION_PLAN_ID,
  label: "Essai 1 mois",
  durationMonths: 1,
  priceCfa: 0,
};

function parseTrialMinutesFromEnv(): number | null {
  const raw = import.meta.env.VITE_TRIAL_MINUTES as string | undefined;
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 525600);
}

/** `true` si `VITE_TRIAL_MINUTES` est défini (essai en minutes, pour tests). */
export function isTrialShortMode(): boolean {
  return parseTrialMinutesFromEnv() != null;
}

/** Libellé affiché pour le plan d’essai (1 mois ou durée en minutes si variable d’environnement). */
export function getTrialPlanLabel(): string {
  const m = parseTrialMinutesFromEnv();
  if (m != null) return m === 1 ? "Essai (1 minute)" : `Essai (${m} min)`;
  return "Essai 1 mois";
}

/** Date de fin d’essai : 1 mois calendaire par défaut, ou `from + N minutes` si `VITE_TRIAL_MINUTES=N`. */
export function getTrialExpiresAt(from: Date): Date {
  const minutes = parseTrialMinutesFromEnv();
  if (minutes != null) return new Date(from.getTime() + minutes * 60_000);
  return addCalendarMonths(from, 1);
}

/** Affichage date/heure d’échéance (avec heure si essai court). */
export function formatTrialExpiryDisplay(expiry: Date): string {
  if (isTrialShortMode()) {
    return expiry.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
  }
  return expiry.toLocaleDateString("fr-FR", { dateStyle: "long" });
}

/** Temps restant lisible (secondes → jours selon l’ampleur). */
export function formatSubscriptionTimeRemaining(from: Date, expiry: Date): string {
  const ms = expiry.getTime() - from.getTime();
  if (ms <= 0) return "0 s";
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  if (totalSec < 90) return `${totalSec} s`;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m} min ${s} s`;
  }
  if (totalSec < 86400) {
    const h = Math.floor(totalSec / 3600);
    const min = Math.floor((totalSec % 3600) / 60);
    return `${h} h ${min} min`;
  }
  const d = Math.max(1, Math.ceil(ms / 86_400_000));
  return `${d} jour${d > 1 ? "s" : ""}`;
}

/** Formules payantes (sélection Orange Money). */
export const SUBSCRIPTION_PLANS: PaidSubscriptionPlanDef[] = [
  { id: "1m", label: "1 mois", durationMonths: 1, priceCfa: 5_000 },
  { id: "3m", label: "3 mois", durationMonths: 3, priceCfa: 12_500 },
  { id: "6m", label: "6 mois", durationMonths: 6, priceCfa: 25_000 },
  { id: "1y", label: "1 an", durationMonths: 12, priceCfa: 50_000 },
  { id: "lifetime", label: "À vie", durationMonths: 0, priceCfa: 950_000, isLifetime: true },
];

const PLAN_BY_ID: Record<string, SubscriptionPlanDef | undefined> = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((p): [string, SubscriptionPlanDef] => [p.id, p]),
);

export function getSubscriptionPlan(planId: string): SubscriptionPlanDef | undefined {
  if (planId === TRIAL_SUBSCRIPTION_PLAN_ID) {
    return { ...TRIAL_SUBSCRIPTION_PLAN, label: getTrialPlanLabel() };
  }
  return PLAN_BY_ID[planId];
}

export function formatCfa(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

/** Prolonge `from` de `months` mois (calendrier). */
export function addCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Libellé pour la durée totale souscrite (somme des formules des paiements validés).
 * Ex. 1 mois + 3 mois → « 4 mois ».
 */
export function formatCumulativeSubscriptionLabel(totalMonths: number): string {
  if (totalMonths <= 0) return "";
  if (totalMonths === 12) return "1 an";
  if (totalMonths > 12 && totalMonths % 12 === 0) {
    const years = totalMonths / 12;
    return `${years} ans`;
  }
  return `${totalMonths} mois`;
}

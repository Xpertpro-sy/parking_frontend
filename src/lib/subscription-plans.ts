export type SubscriptionPlanId = "1m" | "3m" | "6m" | "1y";

export type SubscriptionPlanDef = {
  id: SubscriptionPlanId;
  label: string;
  durationMonths: number;
  priceCfa: number;
};

/** Numéro affiché pour les dépôts Orange Money (Mali). */
export const ORANGE_MONEY_PHONE_DISPLAY = "+223 78 71 16 23";

export const SUBSCRIPTION_PLANS: SubscriptionPlanDef[] = [
  { id: "1m", label: "1 mois", durationMonths: 1, priceCfa: 5_000 },
  { id: "3m", label: "3 mois", durationMonths: 3, priceCfa: 12_500 },
  { id: "6m", label: "6 mois", durationMonths: 6, priceCfa: 25_000 },
  { id: "1y", label: "1 an", durationMonths: 12, priceCfa: 50_000 },
];

const PLAN_BY_ID: Record<string, SubscriptionPlanDef | undefined> = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((p) => [p.id, p]),
);

export function getSubscriptionPlan(planId: string): SubscriptionPlanDef | undefined {
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

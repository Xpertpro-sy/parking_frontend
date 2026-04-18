import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Car, CreditCard, Loader2, Save, UserCog } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN } from "@/lib/tenant-admin-manager-limit";
import {
  getTenantAdminDetailForSuperAdminRequest,
  setTenantAdminMaxManagersSuperAdminRequest,
  superAdminTenantAdminDetailQueryKey,
  superAdminTenantAdminsQueryKey,
} from "@/lib/super-admin-platform-api";
import { tenantAdminMaxManagersQueryKey } from "@/lib/tenant-admin-manager-limit";
import { cn } from "@/lib/utils";
import type { SubscriptionDaySummary } from "@/lib/subscription-api";

function subscriptionSummaryToneClass(variant: SubscriptionDaySummary["variant"]) {
  switch (variant) {
    case "success":
      return "text-emerald-700 dark:text-emerald-400";
    case "warning":
      return "text-amber-700 dark:text-amber-400";
    case "destructive":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}

export default function SuperAdminTenantAdminDetailPage() {
  const { adminUid } = useParams<{ adminUid: string }>();
  const queryClient = useQueryClient();
  const [draftMax, setDraftMax] = useState<number | null>(null);

  const { data: detail, isLoading, isError, error } = useQuery({
    queryKey: superAdminTenantAdminDetailQueryKey(adminUid ?? ""),
    queryFn: () => getTenantAdminDetailForSuperAdminRequest(adminUid!),
    enabled: Boolean(adminUid),
  });

  const effectiveDraft =
    draftMax !== null ? draftMax : detail?.maxManagers ?? DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN;

  useEffect(() => {
    setDraftMax(null);
  }, [adminUid]);

  const saveMutation = useMutation({
    mutationFn: (n: number) => setTenantAdminMaxManagersSuperAdminRequest(adminUid!, n),
    onSuccess: async (_void, savedMax) => {
      toast.success("Plafond de gestionnaires enregistré.");
      setDraftMax(null);
      queryClient.setQueryData(superAdminTenantAdminDetailQueryKey(adminUid!), (prev) =>
        prev && typeof prev === "object" ? { ...prev, maxManagers: savedMax } : prev,
      );
      await queryClient.invalidateQueries({ queryKey: superAdminTenantAdminDetailQueryKey(adminUid!) });
      await queryClient.invalidateQueries({ queryKey: superAdminTenantAdminsQueryKey });
      await queryClient.invalidateQueries({ queryKey: tenantAdminMaxManagersQueryKey(adminUid!) });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    },
  });

  if (!adminUid) {
    return (
      <div className="text-sm text-destructive">
        Identifiant manquant. <Link to="/admin/comptes" className="underline">Retour à la liste</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <Link
        to="/admin/comptes"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux administrateurs
      </Link>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Erreur de chargement."}
        </div>
      )}

      {detail && !isLoading && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-7 w-7 text-amber-600" />
              {detail.displayName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{detail.email}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                <Car className="h-5 w-5 text-primary" />
                Véhicules
              </div>
              <p className="text-3xl font-semibold tabular-nums">{detail.vehicleCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Véhicules enregistrés pour ce compte</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                <UserCog className="h-5 w-5 text-primary" />
                Gestionnaires
              </div>
              <p className="text-3xl font-semibold tabular-nums">{detail.managerAccessCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Fiches d’accès créées (actives ou non)</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Abonnement — état du jour
              </h2>
              <Link
                to="/admin/abonnements"
                className="text-sm font-medium text-primary hover:underline"
              >
                Gérer les abonnements
              </Link>
            </div>
            <p className={cn("text-lg font-semibold", subscriptionSummaryToneClass(detail.subscriptionDaySummary.variant))}>
              {detail.subscriptionDaySummary.headline}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{detail.subscriptionDaySummary.subline}</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {detail.subscriptionState.isImplicitTrial ? (
                               <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-800 dark:text-amber-200">
                  Essai 1 mois (déduit de la date d’inscription — abonnement non encore enregistré en base)
                </span>
              ) : detail.subscriptionState.subscription?.planId === "trial" ? (
                <span className="rounded-md border border-border bg-muted/40 px-2 py-1 font-medium text-foreground">
                  Essai 1 mois
                </span>
              ) : null}
              {detail.createdAtLabel ? (
                <span className="rounded-md border border-border bg-muted/30 px-2 py-1">
                  Inscription : {detail.createdAtLabel}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-foreground">Plafond de création de gestionnaires</h2>
            <p className="text-sm text-muted-foreground">
              Par défaut, un administrateur locataire peut créer {DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN}{" "}
              gestionnaire(s). Vous pouvez ajuster ce plafond (0 à 500). Si le plafond est inférieur au nombre de
              fiches déjà créées, aucun nouveau gestionnaire ne pourra être ajouté tant qu’il n’y aura pas de place.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">Nombre maximum autorisé</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={effectiveDraft}
                  onChange={(e) => setDraftMax(Number(e.target.value))}
                  className="w-full sm:w-40 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={
                  saveMutation.isPending ||
                  effectiveDraft === detail.maxManagers ||
                  Number.isNaN(effectiveDraft)
                }
                onClick={() => saveMutation.mutate(Math.floor(effectiveDraft))}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Plafond actuellement appliqué : <span className="font-medium text-foreground">{detail.maxManagers}</span>
              {detail.managerAccessCount > detail.maxManagers ? (
                <span className="block mt-1 text-amber-700 dark:text-amber-400">
                  Attention : {detail.managerAccessCount} fiche(s) existent déjà, au-delà du plafond. La création de
                  nouveaux gestionnaires reste bloquée.
                </span>
              ) : null}
            </p>
          </div>

          {/* <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Téléphone :</span> {detail.telephone || "—"}
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">Inscription :</span> {detail.createdAtLabel ?? "—"}
            </p>
          </div> */}
        </>
      )}
    </div>
  );
}

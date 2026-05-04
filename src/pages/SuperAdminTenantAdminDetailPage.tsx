import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Building2,
  Car,
  CreditCard,
  Loader2,
  Save,
  Trash2,
  UserCog,
  UserRoundCheck,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { DEFAULT_MAX_MANAGERS_PER_TENANT_ADMIN } from "@/lib/tenant-admin-manager-limit";
import {
  deactivateTenantAdminSuperAdminRequest,
  getTenantAdminDetailForSuperAdminRequest,
  purgeTenantAdminWorkspaceSuperAdminRequest,
  reactivateTenantAdminSuperAdminRequest,
  setTenantAdminMaxManagersSuperAdminRequest,
  superAdminTenantAdminDetailQueryKey,
  superAdminTenantAdminsQueryKey,
} from "@/lib/super-admin-platform-api";
import { tenantAdminMaxManagersQueryKey } from "@/lib/tenant-admin-manager-limit";
import { cn } from "@/lib/utils";
import type { SubscriptionDaySummary } from "@/lib/subscription-api";
import { getTrialPlanLabel } from "@/lib/subscription-plans";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draftMax, setDraftMax] = useState<number | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeEmailConfirm, setPurgeEmailConfirm] = useState("");

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

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateTenantAdminSuperAdminRequest(adminUid!),
    onSuccess: async () => {
      toast.success("Compte désactivé : l’administrateur et ses gestionnaires ne peuvent plus se connecter.");
      setDeactivateOpen(false);
      await queryClient.invalidateQueries({ queryKey: superAdminTenantAdminDetailQueryKey(adminUid!) });
      await queryClient.invalidateQueries({ queryKey: superAdminTenantAdminsQueryKey });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Désactivation impossible.");
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateTenantAdminSuperAdminRequest(adminUid!),
    onSuccess: async () => {
      toast.success("Compte réactivé : l’administrateur et les gestionnaires associés peuvent à nouveau se connecter.");
      setReactivateOpen(false);
      await queryClient.invalidateQueries({ queryKey: superAdminTenantAdminDetailQueryKey(adminUid!) });
      await queryClient.invalidateQueries({ queryKey: superAdminTenantAdminsQueryKey });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Réactivation impossible.");
    },
  });

  const purgeMutation = useMutation({
    mutationFn: () => purgeTenantAdminWorkspaceSuperAdminRequest(adminUid!),
    onSuccess: async () => {
      toast.success("Données supprimées. L’administrateur peut toujours se connecter.");
      setPurgeOpen(false);
      setPurgeEmailConfirm("");
      await queryClient.invalidateQueries({ queryKey: superAdminTenantAdminsQueryKey });
      navigate("/admin/comptes");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
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
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
              <Building2 className="h-7 w-7 text-amber-600" />
              {detail.displayName}
              {detail.accountStatus === "inactive" ? (
                <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                  Désactivé
                </span>
              ) : null}
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
                  {getTrialPlanLabel()} (déduit de la date d’inscription — abonnement non encore enregistré en base)
                </span>
              ) : detail.subscriptionState.subscription?.planId === "trial" ? (
                <span className="rounded-md border border-border bg-muted/40 px-2 py-1 font-medium text-foreground">
                  {getTrialPlanLabel()}
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
              gestionnaire(s). Vous pouvez ajuster ce plafond (0 à 50). Si le plafond est inférieur au nombre de
              fiches déjà créées, aucun nouveau gestionnaire ne pourra être ajouté tant qu’il n’y aura pas de place.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">Nombre maximum autorisé</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={effectiveDraft}
                  onChange={(e) => setDraftMax(Number(e.target.value))}
                  className="w-full sm:w-40 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={
                  detail.accountStatus === "inactive" ||
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

          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-foreground">Actions sensibles</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  La désactivation bloque la connexion de l’administrateur et de tous ses gestionnaires (données
                  conservées). La suppression des données efface uniquement les données métier et révoque les
                  gestionnaires. Le compte administrateur reste actif et pourra se reconnecter.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              {detail.accountStatus === "inactive" ? (
                <button
                  type="button"
                  disabled={reactivateMutation.isPending}
                  onClick={() => setReactivateOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600/50 bg-emerald-600/10 px-4 py-2.5 text-sm font-medium text-emerald-900 dark:text-emerald-100 hover:bg-emerald-600/15 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {reactivateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserRoundCheck className="h-4 w-4" />
                  )}
                  Réactiver le compte
                </button>
              ) : (
                <button
                  type="button"
                  disabled={deactivateMutation.isPending}
                  onClick={() => setDeactivateOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-600/50 bg-amber-600/10 px-4 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-600/15 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {deactivateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                  Désactiver le compte
                </button>
              )}
              <button
                type="button"
                disabled={purgeMutation.isPending}
                onClick={() => {
                  setPurgeEmailConfirm("");
                  setPurgeOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/15 disabled:opacity-50 disabled:pointer-events-none"
              >
                {purgeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Supprimer toutes les données
              </button>
            </div>
          </div>

          <AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Réactiver cet administrateur ?</AlertDialogTitle>
                <AlertDialogDescription className="text-left space-y-2">
                  <span className="block">
                    <strong>{detail.displayName}</strong> et les gestionnaires rattachés (fiches encore actives, non
                    purgés) pourront à nouveau se connecter.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={(e) => {
                    e.preventDefault();
                    reactivateMutation.mutate();
                  }}
                >
                  Réactiver
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Désactiver cet administrateur ?</AlertDialogTitle>
                <AlertDialogDescription className="text-left space-y-2">
                  <span className="block">
                    L’administrateur <strong>{detail.displayName}</strong> ne pourra plus se connecter. Tous les
                    gestionnaires rattachés seront également désactivés. Les données ne sont pas effacées.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={(e) => {
                    e.preventDefault();
                    deactivateMutation.mutate();
                  }}
                >
                  Désactiver
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={purgeOpen} onOpenChange={(o) => { setPurgeOpen(o); if (!o) setPurgeEmailConfirm(""); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer les données de cet administrateur ?</AlertDialogTitle>
                <AlertDialogDescription className="text-left space-y-3">
                  <span className="block text-foreground">
                    Vous allez supprimer véhicules, ventes, locations, réservations, comptabilité, corbeille, demandes
                    d’abonnement, abonnement enregistré, marque, plafonds et fiches gestionnaires pour{" "}
                    <strong>{detail.displayName}</strong>. Les profils gestionnaires seront révoqués, mais le compte
                    administrateur restera actif et pourra se reconnecter. Cette action est irréversible côté données.
                  </span>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-foreground">
                      Saisissez l’e-mail de l’administrateur pour confirmer :{" "}
                      <span className="text-muted-foreground font-normal">{detail.email}</span>
                    </span>
                    <Input
                      value={purgeEmailConfirm}
                      onChange={(e) => setPurgeEmailConfirm(e.target.value)}
                      placeholder="E-mail exact"
                      autoComplete="off"
                    />
                  </label>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={
                    purgeMutation.isPending ||
                    purgeEmailConfirm.trim().toLowerCase() !== detail.email.trim().toLowerCase()
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    if (purgeEmailConfirm.trim().toLowerCase() !== detail.email.trim().toLowerCase()) return;
                    purgeMutation.mutate();
                  }}
                >
                  {purgeMutation.isPending ? "Suppression…" : "Supprimer les données"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  LayoutList,
  Loader2,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SUBSCRIPTION_PLANS, formatCfa } from "@/lib/subscription-plans";
import {
  approveSubscriptionRequestSuperAdminRequest,
  getSuperAdminSubscriptionsOverviewRequest,
  rejectSubscriptionRequestSuperAdminRequest,
  superAdminPendingSubscriptionsQueryKey,
  superAdminSubscriptionsOverviewQueryKey,
  type SubscriptionRequestRow,
  type TenantSubscriptionRow,
} from "@/lib/subscription-api";

function statusLabelFr(status: string) {
  if (status === "pending") return "En attente";
  if (status === "approved") return "Validé";
  if (status === "rejected") return "Refusé";
  return status;
}

export default function SuperAdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: superAdminSubscriptionsOverviewQueryKey,
    queryFn: getSuperAdminSubscriptionsOverviewRequest,
  });

  const [rejectTarget, setRejectTarget] = useState<SubscriptionRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: superAdminSubscriptionsOverviewQueryKey }),
      queryClient.invalidateQueries({ queryKey: superAdminPendingSubscriptionsQueryKey }),
    ]);

  const approveMut = useMutation({
    mutationFn: (id: string) => approveSubscriptionRequestSuperAdminRequest(id),
    onSuccess: async () => {
      toast.success("Abonnement validé et appliqué au compte locataire.");
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action impossible."),
  });

  const rejectMut = useMutation({
    mutationFn: (p: { id: string; reason: string }) =>
      rejectSubscriptionRequestSuperAdminRequest(p.id, p.reason),
    onSuccess: async () => {
      toast.success("Demande refusée.");
      setRejectTarget(null);
      setRejectReason("");
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action impossible."),
  });

  const now = Date.now();
  const tenantSubs = data?.tenantSubscriptions ?? [];
  const activeSubs = tenantSubs.filter((s) => s.isLifetime || (s.expiresAt && new Date(s.expiresAt).getTime() > now));
  const expiredSubs = tenantSubs.filter((s) => !s.isLifetime && (!s.expiresAt || new Date(s.expiresAt).getTime() <= now));
  const historyRequests = (data?.requests ?? []).filter((r) => r.status !== "pending");
  const pending = data?.pending ?? [];

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-amber-600" />
          Abonnements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vérifier les paiements Orange Money, valider ou refuser les demandes, consulter les abonnements actifs et
          expirés.
        </p>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Erreur de chargement."}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement…
        </div>
      )}

      {!isLoading && !isError && (
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-xl border border-border bg-muted/50 p-1.5 sm:inline-flex sm:w-auto">
            <TabsTrigger value="pending" className="gap-1.5 rounded-lg px-3 py-2">
              <Clock className="h-3.5 w-3.5" />
              En attente
              {pending.length > 0 ? (
                <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                  {pending.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-1.5 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Actifs ({activeSubs.length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="gap-1.5 rounded-lg px-3 py-2">
              <XCircle className="h-3.5 w-3.5" />
              Expirés ({expiredSubs.length})
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5 rounded-lg px-3 py-2">
              <LayoutList className="h-3.5 w-3.5" />
              Formules
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 rounded-lg px-3 py-2">
              Historique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">Aucune demande en attente.</p>
            ) : (
              <div className="space-y-4">
                {pending.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">Entreprise (admin) :</span>{" "}
                          <Link
                            to={`/admin/comptes/${row.ownerUid}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.ownerDisplayName || row.ownerEmail || row.ownerUid}
                          </Link>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Formule :</span>{" "}
                          {SUBSCRIPTION_PLANS.find((p) => p.id === row.planId)?.label ?? row.planId}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Montant :</span> {formatCfa(row.amountCfa)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">ID dépôt :</span>{" "}
                          <span className="font-mono">{row.depositReference}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleString("fr-FR", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={approveMut.isPending || rejectMut.isPending}
                          onClick={() => approveMut.mutate(row.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Valider l&apos;abonnement
                        </button>
                        <button
                          type="button"
                          disabled={approveMut.isPending || rejectMut.isPending}
                          onClick={() => {
                            setRejectReason("");
                            setRejectTarget(row);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <SubsTable rows={activeSubs} variant="active" />
          </TabsContent>

          <TabsContent value="expired" className="mt-6">
            <SubsTable rows={expiredSubs} variant="expired" />
          </TabsContent>

          <TabsContent value="plans" className="mt-6">
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Formule</th>
                    <th className="px-4 py-3">Durée</th>
                    <th className="px-4 py-3">Prix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SUBSCRIPTION_PLANS.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium">{p.label}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.isLifetime ? "À vie" : `${p.durationMonths} mois`}
                      </td>
                      <td className="px-4 py-3">{formatCfa(p.priceCfa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {historyRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun historique.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Locataire</th>
                      <th className="px-3 py-2">Formule</th>
                      <th className="px-3 py-2">Montant</th>
                      <th className="px-3 py-2">ID dépôt</th>
                      <th className="px-3 py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyRequests.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleString("fr-FR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Link to={`/admin/comptes/${row.ownerUid}`} className="text-primary hover:underline">
                            {row.ownerEmail || row.ownerUid.slice(0, 8) + "…"}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {SUBSCRIPTION_PLANS.find((p) => p.id === row.planId)?.label ?? row.planId}
                        </td>
                        <td className="px-3 py-2">{formatCfa(row.amountCfa)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.depositReference}</td>
                        <td className="px-3 py-2">{statusLabelFr(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={rejectTarget !== null} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser cette demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Indiquez un motif (visible côté traçabilité interne). L&apos;administrateur pourra soumettre une nouvelle
              demande.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motif du refus…"
            rows={3}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejectMut.isPending}>Annuler</AlertDialogCancel>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              disabled={rejectMut.isPending || rejectReason.trim().length < 3}
              onClick={() => {
                if (rejectTarget) {
                  rejectMut.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
                }
              }}
            >
              {rejectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer le refus"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubsTable({ rows, variant }: { rows: TenantSubscriptionRow[]; variant: "active" | "expired" }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        {variant === "active" ? "Aucun abonnement actif enregistré." : "Aucun abonnement expiré listé."}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2">Compte (UID admin)</th>
            <th className="px-3 py-2">Formule</th>
            <th className="px-3 py-2">Fin de période</th>
            <th className="px-3 py-2">Dernière validation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((s) => (
            <tr key={s.ownerUid}>
              <td className="px-3 py-2">
                <Link to={`/admin/comptes/${s.ownerUid}`} className="text-primary hover:underline font-mono text-xs">
                  {s.ownerUid.slice(0, 10)}…
                </Link>
              </td>
              <td className="px-3 py-2">
                {s.cumulativePlanLabel ??
                  SUBSCRIPTION_PLANS.find((p) => p.id === s.planId)?.label ??
                  (s.planId ? s.planId : "—")}
              </td>
              <td className="px-3 py-2">
                {s.isLifetime
                  ? "À vie"
                  : s.expiresAt
                  ? new Date(s.expiresAt).toLocaleDateString("fr-FR", { dateStyle: "long" })
                  : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground text-xs">
                {s.lastApprovedRequestId ? s.lastApprovedRequestId.slice(0, 12) + "…" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

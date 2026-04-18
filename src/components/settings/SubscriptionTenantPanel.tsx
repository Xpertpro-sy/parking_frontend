import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, CreditCard, Loader2, Phone, Shield } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUserAccessProfile } from "@/lib/access-control";
import {
  ORANGE_MONEY_PHONE_DISPLAY,
  SUBSCRIPTION_PLANS,
  formatCfa,
  type SubscriptionPlanId,
} from "@/lib/subscription-plans";
import {
  getTenantSubscriptionStateRequest,
  listTenantSubscriptionRequestsRequest,
  submitSubscriptionRequestRequest,
  tenantSubscriptionRequestsQueryKey,
  tenantSubscriptionStateQueryKey,
} from "@/lib/subscription-api";

export default function SubscriptionTenantPanel() {
  const queryClient = useQueryClient();
  const { data: accessProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["access-profile"],
    queryFn: getCurrentUserAccessProfile,
  });

  const ownerUid = accessProfile?.uid ?? "";
  const isAdmin = accessProfile?.role === "ADMIN";
  const isManager = accessProfile?.role === "GESTIONNAIRE";

  const { data: state, isLoading: stateLoading } = useQuery({
    queryKey: tenantSubscriptionStateQueryKey(ownerUid),
    queryFn: () => getTenantSubscriptionStateRequest(ownerUid),
    enabled: Boolean(ownerUid && (isAdmin || isManager)),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: tenantSubscriptionRequestsQueryKey(ownerUid),
    queryFn: () => listTenantSubscriptionRequestsRequest(ownerUid),
    enabled: Boolean(ownerUid && (isAdmin || isManager)),
  });

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId | null>(null);
  const [depositId, setDepositId] = useState("");
  const [submittedPending, setSubmittedPending] = useState(false);

  const pendingRequest = useMemo(() => history.find((r) => r.status === "pending"), [history]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlan) throw new Error("Choisissez une formule.");
      return submitSubscriptionRequestRequest({
        planId: selectedPlan,
        depositReference: depositId.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("Demande enregistrée.");
      setSubmittedPending(true);
      setDepositId("");
      setSelectedPlan(null);
      await queryClient.invalidateQueries({ queryKey: tenantSubscriptionRequestsQueryKey(ownerUid) });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    },
  });

  const loading = profileLoading || stateLoading || historyLoading;

  if (loading && !accessProfile) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (!isAdmin && !isManager) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        Abonnement réservé aux comptes entreprise.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Abonnement</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {isManager
            ? "Votre espace est rattaché à l’abonnement de l’administrateur de l’entreprise. Vous pouvez consulter la formule et l’échéance ci-dessous."
            : "Choisissez une formule, effectuez le dépôt Orange Money, puis transmettez l’ID de transaction pour validation sous 24 h."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/30 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Formule en cours</p>
          <p className="mt-2 text-xl font-semibold text-foreground">
            {state?.isActive ? state.planLabel ?? "—" : "Aucun abonnement actif"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {state?.isActive && state.expiresAtLabel
              ? `Valable jusqu’au ${state.expiresAtLabel}`
              : "Souscrivez ou renouvelez pour continuer à utiliser tous les modules."}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut paiement</p>
          <p className="mt-2 text-xl font-semibold text-foreground flex items-center gap-2">
            {pendingRequest ? (
              <>
                <Clock className="h-5 w-5 text-amber-600" />
                En attente de vérification
              </>
            ) : state?.isActive ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Actif
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                À régler
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pendingRequest
              ? "Notre équipe vérifie votre dépôt (sous 24 h ouvrées)."
              : state?.isActive
                ? "Renouvellement possible avant expiration."
                : "Effectuez un paiement pour activer l’abonnement."}
          </p>
        </div>
      </div>

      {(submittedPending || pendingRequest) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-foreground">
          <p className="font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            Demande en attente de vérification
          </p>
          <p className="mt-2 text-muted-foreground">
            Votre paiement et votre ID de dépôt seront vérifiés par la plateforme sous <strong>24 heures</strong>. Vous
            recevrez l’activation ou un message en cas de problème.
          </p>
        </div>
      )}

      {isAdmin && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Formules disponibles</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  disabled={Boolean(pendingRequest)}
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    setSubmittedPending(false);
                  }}
                  className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${
                    selectedPlan === plan.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <p className="font-semibold text-foreground">{plan.label}</p>
                  <p className="text-lg font-bold text-primary mt-1">{formatCfa(plan.priceCfa)}</p>
                </button>
              ))}
            </div>
          </div>

          {selectedPlan && !pendingRequest && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-background border border-border p-2.5">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Paiement Orange Money</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Envoyez <strong>{formatCfa(SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlan)!.priceCfa)}</strong>{" "}
                    au numéro :
                  </p>
                  <p className="text-lg font-mono font-bold text-foreground mt-2 tracking-wide">
                    {ORANGE_MONEY_PHONE_DISPLAY}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">ID de dépôt</label>
                <input
                  value={depositId}
                  onChange={(e) => setDepositId(e.target.value)}
                  placeholder="Référence / ID reçu après le dépôt"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                  autoComplete="off"
                />
              </div>

              <button
                type="button"
                disabled={submitMutation.isPending || depositId.trim().length < 4}
                onClick={() => submitMutation.mutate()}
                className="w-full sm:w-auto rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Valider
              </button>
            </div>
          )}

          {pendingRequest && (
            <p className="text-sm text-muted-foreground">
              Une demande est déjà en cours pour la formule{" "}
              <strong>{SUBSCRIPTION_PLANS.find((p) => p.id === pendingRequest.planId)?.label ?? pendingRequest.planId}</strong>{" "}
              ({formatCfa(pendingRequest.amountCfa)}), ID dépôt :{" "}
              <span className="font-mono">{pendingRequest.depositReference}</span>.
            </p>
          )}
        </>
      )}

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Historique des demandes</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande enregistrée.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Formule</th>
                  <th className="px-3 py-2">Montant</th>
                  <th className="px-3 py-2">ID dépôt</th>
                  <th className="px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {row.createdAt
                        ? new Date(row.createdAt).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{SUBSCRIPTION_PLANS.find((p) => p.id === row.planId)?.label ?? row.planId}</td>
                    <td className="px-3 py-2">{formatCfa(row.amountCfa)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.depositReference}</td>
                    <td className="px-3 py-2">
                      {row.status === "pending" && <span className="text-amber-600">En attente</span>}
                      {row.status === "approved" && <span className="text-emerald-600">Validé</span>}
                      {row.status === "rejected" && (
                        <span className="text-destructive" title={row.rejectReason ?? ""}>
                          Refusé
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

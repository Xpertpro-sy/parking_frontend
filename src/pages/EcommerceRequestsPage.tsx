import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock, Loader2, MailQuestion, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  ecommerceRequestsCountQueryKey,
  ecommerceRequestsQueryKey,
  listEcommerceCustomerRequestsRequest,
  updateEcommerceCustomerRequestStatusRequest,
  type EcommerceCustomerRequest,
} from "@/lib/ecommerce-api";

const requestTypeLabel: Record<EcommerceCustomerRequest["requestType"], string> = {
  reservation: "Réservation",
  rental: "Location",
};

const statusLabel: Record<EcommerceCustomerRequest["status"], string> = {
  pending: "En attente",
  contacted: "Contacté",
  validated: "Validé",
  closed: "Clôturé",
};

export default function EcommerceRequestsPage() {
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading, isError, error } = useQuery({
    queryKey: ecommerceRequestsQueryKey,
    queryFn: listEcommerceCustomerRequestsRequest,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EcommerceCustomerRequest["status"] }) =>
      updateEcommerceCustomerRequestStatusRequest(id, status),
    onSuccess: async () => {
      toast.success("Demande mise à jour.");
      await queryClient.invalidateQueries({ queryKey: ecommerceRequestsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ecommerceRequestsCountQueryKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MailQuestion className="h-7 w-7 text-primary" />
          Demandes e-commerce
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demandes envoyées par les clients depuis votre lien e-commerce.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement des demandes...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "Impossible de charger les demandes."}
        </div>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucune demande client pour le moment.
        </div>
      )}

      {!isLoading && !isError && requests.length > 0 && (
        <div className="grid gap-4">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {requestTypeLabel[request.requestType]}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                      {statusLabel[request.status]}
                    </span>
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-foreground">{request.vehicleLabel}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Client: <span className="font-medium text-foreground">{request.customerName}</span>
                  </p>
                  <a
                    href={`tel:${request.customerPhone}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {request.customerPhone}
                  </a>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(request.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                {request.status !== "validated" && request.status !== "closed" && (
                  <button
                    type="button"
                    onClick={() => updateStatusMutation.mutate({ id: request.id, status: "validated" })}
                    disabled={updateStatusMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Valider commande
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

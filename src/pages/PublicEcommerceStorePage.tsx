import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Car, Loader2, Phone, Search, ShoppingBag } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  createEcommerceCustomerRequest,
  getPublicEcommerceCustomerRequestStatusRequest,
  getPublicEcommerceStoreRequest,
  publicEcommerceRequestStatusQueryKey,
  publicEcommerceStoreQueryKey,
  type PublicEcommerceVehicle,
} from "@/lib/ecommerce-api";
import { STATUS_LABELS, type VehicleStatus } from "@/types/vehicle";

const statusTone: Record<VehicleStatus, string> = {
  available: "bg-emerald-100 text-emerald-700",
  rented: "bg-sky-100 text-sky-700",
  reserved: "bg-violet-100 text-violet-700",
  repair: "bg-amber-100 text-amber-800",
  sold: "bg-rose-100 text-rose-700",
};

export default function PublicEcommerceStorePage() {
  const { token = "" } = useParams<{ token: string }>();
  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<PublicEcommerceVehicle | null>(null);
  const [requestType, setRequestType] = useState<"reservation" | "rental">("reservation");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [trackedRequestId, setTrackedRequestId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(`ecommerce-request:${token}`) ?? "";
  });

  const { data: store, isLoading, isError, error } = useQuery({
    queryKey: publicEcommerceStoreQueryKey(token),
    queryFn: () => getPublicEcommerceStoreRequest(token),
    enabled: Boolean(token),
  });

  const requestMutation = useMutation({
    mutationFn: createEcommerceCustomerRequest,
    onSuccess: (requestId) => {
      setTrackedRequestId(requestId);
      window.localStorage.setItem(`ecommerce-request:${token}`, requestId);
      window.localStorage.removeItem(`ecommerce-request-notified:${requestId}`);
      toast.success("Demande envoyée. L'administrateur vous contactera.");
      setSelectedVehicle(null);
      setCustomerName("");
      setCustomerPhone("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Impossible d'envoyer la demande.");
    },
  });

  const { data: trackedRequest } = useQuery({
    queryKey: publicEcommerceRequestStatusQueryKey(trackedRequestId),
    queryFn: () => getPublicEcommerceCustomerRequestStatusRequest(trackedRequestId),
    enabled: Boolean(trackedRequestId),
    refetchInterval: (query) => (query.state.data?.status === "validated" ? false : 5000),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!trackedRequest || trackedRequest.status !== "validated") return;
    const notifiedKey = `ecommerce-request-notified:${trackedRequest.id}`;
    if (window.localStorage.getItem(notifiedKey)) return;
    window.localStorage.setItem(notifiedKey, "1");
    toast.success("Bonne nouvelle : votre commande a été validée par l'administrateur.");
  }, [trackedRequest]);

  const vehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = (store?.vehicles ?? []).filter((vehicle) => vehicle.status !== "sold");
    if (!q) return items;
    return items.filter((vehicle) =>
      [vehicle.brand, vehicle.model, vehicle.plate, vehicle.color, vehicle.fuel].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [search, store?.vehicles]);

  const openRequest = (vehicle: PublicEcommerceVehicle, type: "reservation" | "rental") => {
    if (vehicle.status !== "available") {
      toast.info("Ce véhicule n'est pas disponible pour une nouvelle demande.");
      return;
    }
    setSelectedVehicle(vehicle);
    setRequestType(type);
  };

  const onSubmitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!store || !selectedVehicle) return;
    requestMutation.mutate({
      ownerUid: store.ownerUid,
      sourceToken: token,
      vehicleId: selectedVehicle.id,
      vehicleLabel: `${selectedVehicle.brand} ${selectedVehicle.model} - ${selectedVehicle.plate}`,
      requestType,
      customerName,
      customerPhone,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Chargement du catalogue...</p>
      </div>
    );
  }

  if (isError || !store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Lien indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Ce catalogue e-commerce n'est pas actif ou n'existe plus."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-muted/20">
      <header className="border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catalogue e-commerce</p>
              <h1 className="mt-0.5 text-2xl font-bold text-foreground">{store.adminName}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Consultez les véhicules, leurs prix de vente, prix de location et leur disponibilité avant d'envoyer une
              demande.
              </p>
            </div>
          </div>
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher marque, modèle..."
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {trackedRequest?.status === "validated" && (
          <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800">
            Votre commande pour <span className="font-semibold">{trackedRequest.vehicleLabel}</span> a été validée.
            {" "}
            {trackedRequest.validatedByName ? (
              <>
                Validée par <span className="font-semibold">{trackedRequest.validatedByName}</span>.
              </>
            ) : (
              "L'administrateur va vous contacter pour la suite."
            )}
          </div>
        )}

        {vehicles.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun véhicule trouvé.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vehicles.map((vehicle) => (
              <article
                key={vehicle.id}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative h-36 bg-secondary">
                  {vehicle.photos[0] ? (
                    <img src={vehicle.photos[0]} alt={`${vehicle.brand} ${vehicle.model}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Car className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${statusTone[vehicle.status]}`}>
                    {STATUS_LABELS[vehicle.status]}
                  </span>
                </div>
                <div className="space-y-3 p-3.5">
                  <div>
                    <h2 className="truncate text-base font-semibold text-foreground">
                      {vehicle.brand} {vehicle.model}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {vehicle.year} · {vehicle.plate} · {vehicle.mileage.toLocaleString()} km
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-secondary/60 p-2">
                      <p className="text-[11px] text-muted-foreground">Vente</p>
                      <p className="truncate font-semibold text-foreground">{vehicle.salePrice.toLocaleString()} CFA</p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 p-2">
                      <p className="text-[11px] text-muted-foreground">Location</p>
                      <p className="truncate font-semibold text-foreground">{vehicle.rentalPrice.toLocaleString()} / j</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openRequest(vehicle, "reservation")}
                      disabled={vehicle.status !== "available"}
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Réserver
                    </button>
                    <button
                      type="button"
                      onClick={() => openRequest(vehicle, "rental")}
                      disabled={vehicle.status !== "available"}
                      className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Louer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <form onSubmit={onSubmitRequest} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">
              Demande de {requestType === "reservation" ? "réservation" : "location"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.plate}
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nom complet</label>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Téléphone</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedVehicle(null)}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={requestMutation.isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {requestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Phone className="h-4 w-4" />
                    Envoyer
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

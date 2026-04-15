import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useVehicleDetailQuery, vehicleQueryKeys } from "@/lib/vehicle-queries";
import { createSaleRequest } from "@/lib/sale-api";

export default function SaleForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehicleId = searchParams.get("vehicleId") ?? "";

  const { data: vehicle, isLoading: loadingVehicle } = useVehicleDetailQuery(vehicleId || undefined);
  const [submitting, setSubmitting] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [saleDate, setSaleDate] = useState("");

  useEffect(() => {
    if (vehicle) {
      setAmount(String(vehicle.salePrice));
    }
  }, [vehicle]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!vehicleId) {
      toast.error("Vehicule introuvable.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Montant invalide.");
      return;
    }

    setSubmitting(true);
    try {
      await createSaleRequest({
        vehicleId,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim(),
        amount: numericAmount,
        date: saleDate || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["receipts", "list"] });
      toast.success("Vente enregistree avec succes.");
      navigate(`/vehicles/${vehicleId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer la vente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!vehicleId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Aucun vehicule selectionne</p>
        <Link to="/vehicles" className="mt-4 text-primary hover:underline text-sm">
          ← Retour aux vehicules
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to={`/vehicles/${vehicleId}`} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enregistrer une vente</h1>
          <p className="text-muted-foreground text-sm">
            {loadingVehicle ? "Chargement du vehicule..." : `${vehicle?.brand ?? ""} ${vehicle?.model ?? ""} · ${vehicle?.plate ?? ""}`}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="glass-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nom de l'acheteur</label>
            <input
              type="text"
              required
              value={buyerName}
              onChange={(event) => setBuyerName(event.target.value)}
              placeholder="Saisis le nom"
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Telephone de l'acheteur</label>
            <input
              type="tel"
              required
              value={buyerPhone}
              onChange={(event) => setBuyerPhone(event.target.value)}
              placeholder="+223 00 00 00 00"
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Montant de vente (CFA)</label>
            <input
              type="number"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Ex: 18000000"
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            {vehicle && (
              <p className="text-xs text-muted-foreground mt-1">
                Montant attendu: {vehicle.salePrice.toLocaleString()} CFA
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date de vente (optionnel)</label>
            <input
              type="date"
              value={saleDate}
              onChange={(event) => setSaleDate(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || loadingVehicle}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? "Enregistrement..." : "Valider la vente"}
        </button>
      </form>
    </div>
  );
}

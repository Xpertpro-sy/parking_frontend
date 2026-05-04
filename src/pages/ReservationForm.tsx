import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { accountMovementsQueryKey } from "@/lib/accounting-api";
import { createReservationRequest } from "@/lib/vehicle-action-api";
import { useVehicleDetailQuery, vehicleQueryKeys } from "@/lib/vehicle-queries";

export default function ReservationForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehicleId = searchParams.get("vehicleId") ?? "";
  const { data: vehicle, isLoading: loadingVehicle } = useVehicleDetailQuery(vehicleId || undefined);

  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reservationDate, setReservationDate] = useState(new Date().toISOString().slice(0, 10));
  const [reservationEndDate, setReservationEndDate] = useState("");
  const [reservationAmountPaid, setReservationAmountPaid] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");

  useEffect(() => {
    if (vehicle) {
      setReservationAmountPaid(String(vehicle.rentalPrice));
    }
  }, [vehicle]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vehicleId || !vehicle) {
      toast.error("Vehicule introuvable.");
      return;
    }

    const parsedAmount = Number(reservationAmountPaid);
    if (!customerName.trim() || !customerPhone.trim() || !reservationDate || Number.isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error("Nom, telephone, jour et montant paye sont obligatoires.");
      return;
    }
    if (parsedAmount > vehicle.rentalPrice) {
      toast.error("Le montant paye ne peut pas depasser le prix de location de cette voiture.");
      return;
    }

    setSubmitting(true);
    try {
      await createReservationRequest(vehicleId, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: reservationNotes.trim() || undefined,
        reservationDate,
        reservationEndDate: reservationEndDate.trim() || undefined,
        amountPaid: parsedAmount,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["reservations", "list"] });
      await queryClient.invalidateQueries({ queryKey: accountMovementsQueryKey });
      toast.success("Reservation enregistree avec succes.");
      navigate(`/vehicles/${vehicleId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer la reservation.");
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
          <h1 className="text-2xl font-bold text-foreground">Nouvelle reservation</h1>
          <p className="text-muted-foreground text-sm">
            {loadingVehicle ? "Chargement du vehicule..." : `${vehicle?.brand ?? ""} ${vehicle?.model ?? ""} · ${vehicle?.plate || "Sans immatriculation"}`}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="glass-card p-6 space-y-5">
        {vehicle && (
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Resume du vehicule</p>
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Vehicule</p>
                <p className="font-medium text-foreground">{vehicle.brand} {vehicle.model}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Immatriculation</p>
                <p className="font-medium text-foreground">{vehicle.plate || "Non renseignee"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Etat</p>
                <p className="font-medium text-foreground">{vehicle.condition}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Prix location</p>
                <p className="font-medium text-foreground">{vehicle.rentalPrice.toLocaleString()} CFA</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nom client</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Telephone client</label>
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Jour de reservation (debut)</label>
            <input
              type="date"
              required
              value={reservationDate}
              onChange={(event) => setReservationDate(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Dernier jour (optionnel)</label>
            <input
              type="date"
              value={reservationEndDate}
              min={reservationDate || undefined}
              onChange={(event) => setReservationEndDate(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Montant paye (CFA)</label>
          <input
            type="number"
            min={0}
            max={vehicle?.rentalPrice}
            value={reservationAmountPaid}
            readOnly
            disabled
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground/90 cursor-not-allowed"
          />
          {vehicle && (
            <p className="mt-1 text-xs text-muted-foreground">
              Montant fixe selon le prix de location: {vehicle.rentalPrice.toLocaleString()} CFA
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Notes (optionnel)</label>
          <textarea
            rows={4}
            value={reservationNotes}
            onChange={(event) => setReservationNotes(event.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || loadingVehicle}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? "Enregistrement..." : "Confirmer reservation"}
        </button>
      </form>
    </div>
  );
}

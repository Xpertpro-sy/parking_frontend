import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { accountMovementsQueryKey } from "@/lib/accounting-api";
import { createRepairRequest } from "@/lib/vehicle-action-api";
import { useVehicleDetailQuery, vehicleQueryKeys } from "@/lib/vehicle-queries";

export default function RepairForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehicleId = searchParams.get("vehicleId") ?? "";
  const { data: vehicle, isLoading: loadingVehicle } = useVehicleDetailQuery(vehicleId || undefined);

  const [submitting, setSubmitting] = useState(false);
  const [repairReason, setRepairReason] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [repairStartDate, setRepairStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [repairExpectedEndDate, setRepairExpectedEndDate] = useState("");
  const [repairGarageName, setRepairGarageName] = useState("");
  const [repairTechnicianName, setRepairTechnicianName] = useState("");
  const [repairNotes, setRepairNotes] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vehicleId) {
      toast.error("Vehicule introuvable.");
      return;
    }

    const parsedCost = Number(repairCost);
    if (!repairReason.trim() || !repairStartDate || Number.isNaN(parsedCost) || parsedCost < 0) {
      toast.error("Renseignez un motif, une date et un cout valide.");
      return;
    }
    if (repairExpectedEndDate && repairExpectedEndDate < repairStartDate) {
      toast.error("La date de fin prevue doit etre apres la date de debut.");
      return;
    }

    setSubmitting(true);
    try {
      await createRepairRequest(vehicleId, {
        reason: repairReason.trim(),
        cost: parsedCost,
        startDate: repairStartDate,
        expectedEndDate: repairExpectedEndDate || undefined,
        garageName: repairGarageName.trim() || undefined,
        technicianName: repairTechnicianName.trim() || undefined,
        notes: repairNotes.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["repairs", "list"] });
      await queryClient.invalidateQueries({ queryKey: accountMovementsQueryKey });
      toast.success("Vehicule marque en reparation.");
      navigate(`/vehicles/${vehicleId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de lancer la reparation.");
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
          <h1 className="text-2xl font-bold text-foreground">Mettre en reparation</h1>
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
                <p className="text-muted-foreground">Kilometrage</p>
                <p className="font-medium text-foreground">{vehicle.mileage.toLocaleString()} km</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Motif</label>
          <textarea
            rows={4}
            required
            value={repairReason}
            onChange={(event) => setRepairReason(event.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Garage (optionnel)</label>
            <input
              type="text"
              value={repairGarageName}
              onChange={(event) => setRepairGarageName(event.target.value)}
              placeholder="Ex: Garage Central"
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Technicien (optionnel)</label>
            <input
              type="text"
              value={repairTechnicianName}
              onChange={(event) => setRepairTechnicianName(event.target.value)}
              placeholder="Ex: Mamadou Keita"
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Cout estime (CFA)</label>
            <input
              type="number"
              min={0}
              required
              value={repairCost}
              onChange={(event) => setRepairCost(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date debut reparation</label>
            <input
              type="date"
              required
              value={repairStartDate}
              onChange={(event) => setRepairStartDate(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">Date fin prevue (optionnel)</label>
            <input
              type="date"
              value={repairExpectedEndDate}
              min={repairStartDate || undefined}
              onChange={(event) => setRepairExpectedEndDate(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Notes internes (optionnel)</label>
          <textarea
            rows={3}
            value={repairNotes}
            onChange={(event) => setRepairNotes(event.target.value)}
            placeholder="Pieces a changer, priorite, recommandations..."
            disabled={submitting}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || loadingVehicle}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-warning text-warning-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? "Enregistrement..." : "Confirmer reparation"}
        </button>
      </form>
    </div>
  );
}

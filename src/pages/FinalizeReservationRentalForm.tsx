import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImageToR2 } from "@/lib/cloudflare-upload";
import { LIVE_COLLAB_REFETCH_MS, useVehicleDetailQuery, vehicleQueryKeys } from "@/lib/vehicle-queries";
import { accountMovementsQueryKey } from "@/lib/accounting-api";
import { finalizeReservationToRentalRequest, listReservationsRequest } from "@/lib/vehicle-action-api";

const MAX_FILE_SIZE_MB = 8;
const MAX_IMAGE_DIMENSION = 1600;
const OUTPUT_IMAGE_QUALITY = 0.8;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Le fichier selectionne n'est pas une image.");
  }

  const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire l'image selectionnee."));
    };
    img.src = objectUrl;
  });

  const ratio = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceImage.width, sourceImage.height));
  const targetWidth = Math.max(1, Math.round(sourceImage.width * ratio));
  const targetHeight = Math.max(1, Math.round(sourceImage.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Impossible de preparer la compression de l'image.");
  }
  ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const compressedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, OUTPUT_IMAGE_QUALITY);
  });
  if (!compressedBlob) {
    throw new Error("La compression de l'image a echoue.");
  }

  const extension = outputType === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  return new File([compressedBlob], `${baseName}-compressed.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}

export default function FinalizeReservationRentalForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehicleId = searchParams.get("vehicleId") ?? "";

  const { data: vehicle, isLoading: loadingVehicle } = useVehicleDetailQuery(vehicleId || undefined, { live: true });
  const { data: reservations = [], isLoading: loadingReservations } = useQuery({
    queryKey: ["reservations", "list"],
    queryFn: listReservationsRequest,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });

  const activeReservation = useMemo(
    () => reservations.find((reservation) => reservation.vehicleId === vehicleId && reservation.status === "ACTIVE"),
    [reservations, vehicleId],
  );

  const [submitting, setSubmitting] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantIdCardNumber, setTenantIdCardNumber] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [tenantIdCardPhotoUrl, setTenantIdCardPhotoUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [driverFullName, setDriverFullName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [uploadingIdCard, setUploadingIdCard] = useState(false);

  useEffect(() => {
    if (!activeReservation) return;
    setTenantName(activeReservation.customerName);
    setTenantPhone(activeReservation.customerPhone);
  }, [activeReservation]);

  useEffect(() => {
    const now = new Date();
    const plusOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    setStartDate(now.toISOString().slice(0, 16));
    setEndDate(plusOneDay.toISOString().slice(0, 16));
  }, []);

  const amount = useMemo(() => {
    if (!vehicle || !startDate || !endDate) return "";
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return "";
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / dayMs);
    return String(totalDays * vehicle.rentalPrice);
  }, [vehicle, startDate, endDate]);

  const onSelectIdCardPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`L'image doit faire moins de ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setUploadingIdCard(true);
    try {
      const compressed = await compressImage(file);
      const uploadedUrl = await uploadImageToR2(compressed);
      setTenantIdCardPhotoUrl(uploadedUrl);
      toast.success("Photo CNI uploadee avec succes.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur pendant l'upload de la photo CNI.");
    } finally {
      setUploadingIdCard(false);
      event.target.value = "";
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vehicleId || !amount) {
      toast.error("Informations de location invalides.");
      return;
    }
    if (!activeReservation) {
      toast.error("Aucune reservation active pour ce vehicule.");
      return;
    }
    if (withDriver && (!driverFullName.trim() || !driverPhone.trim())) {
      toast.error("Renseignez le nom complet et le numero du chauffeur.");
      return;
    }

    setSubmitting(true);
    try {
      await finalizeReservationToRentalRequest(vehicleId, {
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim(),
        tenantIdCardNumber: tenantIdCardNumber.trim(),
        tenantIdCardPhotoUrl: tenantIdCardPhotoUrl || undefined,
        tenantAddress: tenantAddress.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        startDate,
        endDate,
        driver: withDriver
          ? {
              fullName: driverFullName.trim(),
              phone: driverPhone.trim(),
            }
          : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["reservations", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["rentals", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["receipts", "list"] });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: accountMovementsQueryKey });
      toast.success("Reservation finalisee en location avec succes.");
      navigate(`/vehicles/${vehicleId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de finaliser la location.");
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

  if (!loadingReservations && !activeReservation) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Aucune reservation active trouvee pour ce vehicule.</p>
        <Link to={`/vehicles/${vehicleId}`} className="mt-4 text-primary hover:underline text-sm">
          ← Retour au vehicule
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
          <h1 className="text-2xl font-bold text-foreground">Finaliser reservation en location</h1>
          <p className="text-muted-foreground text-sm">
            {loadingVehicle ? "Chargement du vehicule..." : `${vehicle?.brand ?? ""} ${vehicle?.model ?? ""} · ${vehicle?.plate ?? ""}`}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="glass-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nom du locataire</label>
            <input
              type="text"
              required
              value={tenantName}
              readOnly
              placeholder="Saisis le nom"
              disabled
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground/90 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">Renseigne automatiquement depuis la reservation.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Telephone</label>
            <input
              type="tel"
              required
              value={tenantPhone}
              readOnly
              placeholder="+223 00 00 00 00"
              disabled
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground/90 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">Renseigne automatiquement depuis la reservation.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date et heure debut</label>
            <input
              type="datetime-local"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date et heure fin</label>
            <input
              type="datetime-local"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Numero CNI / ID</label>
          <input
            type="text"
            required
            value={tenantIdCardNumber}
            onChange={(event) => setTenantIdCardNumber(event.target.value)}
            placeholder="Ex: CNI123456789"
            disabled={submitting}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Adresse locataire (optionnel)</label>
          <textarea
            value={tenantAddress}
            onChange={(event) => setTenantAddress(event.target.value)}
            rows={2}
            disabled={submitting}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-foreground">Photo carte d'identite (optionnel)</label>
            {tenantIdCardPhotoUrl && (
              <button
                type="button"
                onClick={() => setTenantIdCardPhotoUrl("")}
                className="text-xs text-destructive hover:underline"
                disabled={submitting || uploadingIdCard}
              >
                Retirer
              </button>
            )}
          </div>
          {tenantIdCardPhotoUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-border bg-secondary">
              <img
                src={tenantIdCardPhotoUrl}
                alt="Carte d'identite"
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={() => setTenantIdCardPhotoUrl("")}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background"
                disabled={submitting || uploadingIdCard}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="h-32 rounded-lg border-2 border-dashed border-border bg-secondary flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors">
              {uploadingIdCard ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Upload className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {uploadingIdCard ? "Upload..." : "Ajouter photo CNI"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onSelectIdCardPhoto}
                disabled={submitting || uploadingIdCard}
              />
            </label>
          )}
        </div>

        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={withDriver}
              onChange={(event) => setWithDriver(event.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-border"
            />
            Location avec chauffeur
          </label>

          {withDriver && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nom complet du chauffeur</label>
                <input
                  type="text"
                  required={withDriver}
                  value={driverFullName}
                  onChange={(event) => setDriverFullName(event.target.value)}
                  disabled={submitting} placeholder="Saisis le nom et prenom"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Numero du chauffeur</label>
                <input
                  type="tel"
                  required={withDriver}
                  value={driverPhone}
                  onChange={(event) => setDriverPhone(event.target.value)}
                  placeholder="+223 00 00 00 00"
                  disabled={submitting}
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Contact urgence (nom)</label>
            <input
              type="text"
              value={emergencyContactName}
              onChange={(event) => setEmergencyContactName(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Contact urgence (telephone)</label>
            <input
              type="tel"
              value={emergencyContactPhone}
              onChange={(event) => setEmergencyContactPhone(event.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">Montant location calcule automatiquement</p>
          <p className="text-lg font-semibold text-foreground">{amount ? `${Number(amount).toLocaleString()} CFA` : "Renseignez les dates"}</p>
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">Kilometrage de depart</p>
          <p className="text-lg font-semibold text-foreground">
            {vehicle ? `${vehicle.mileage.toLocaleString()} km` : "Chargement..."}
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || uploadingIdCard || !amount || loadingVehicle || loadingReservations}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? "Validation..." : "Valider la location"}
        </button>
      </form>
    </div>
  );
}

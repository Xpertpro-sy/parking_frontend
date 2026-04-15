import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useVehicleDetailQuery, vehicleQueryKeys } from "@/lib/vehicle-queries";
import { createRentalRequest } from "@/lib/rental-api";
import { uploadImageToR2 } from "@/lib/cloudflare-upload";

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

export default function RentalForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehicleId = searchParams.get("vehicleId") ?? "";
  const { data: vehicle, isLoading: loadingVehicle } = useVehicleDetailQuery(vehicleId || undefined);

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
  const [depositAmount, setDepositAmount] = useState("");
  const [uploadingIdCard, setUploadingIdCard] = useState(false);

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
      toast.success("Photo CNI uploadée avec succès.");
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

    setSubmitting(true);
    try {
      await createRentalRequest({
        vehicleId,
        tenantName: tenantName.trim(),
        tenantPhone: tenantPhone.trim(),
        tenantIdCardNumber: tenantIdCardNumber.trim(),
        tenantIdCardPhotoUrl: tenantIdCardPhotoUrl || undefined,
        tenantAddress: tenantAddress.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        startDate,
        endDate,
        amount: Number(amount),
        depositAmount: depositAmount.trim() ? Number(depositAmount) : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["receipts", "list"] });
      toast.success("Location enregistree avec succes.");
      navigate(`/vehicles/${vehicleId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer la location.");
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
          <h1 className="text-2xl font-bold text-foreground">Enregistrer une location</h1>
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
              onChange={(event) => setTenantName(event.target.value)}
              placeholder="Saisis le nom"
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Telephone</label>
            <input
              type="tel"
              required
              value={tenantPhone}
              onChange={(event) => setTenantPhone(event.target.value)}
              placeholder="+223 00 00 00 00"
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Caution (optionnel)</label>
            <input
              type="number"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              placeholder="0"
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground"
            />
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

        <button
          type="submit"
          disabled={submitting || uploadingIdCard || !amount || loadingVehicle}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? "Enregistrement..." : "Valider la location"}
        </button>
      </form>
    </div>
  );
}

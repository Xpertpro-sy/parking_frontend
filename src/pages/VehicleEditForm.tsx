import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageToR2 } from '@/lib/cloudflare-upload';
import { updateVehicleRequest } from '@/lib/vehicle-api';
import { useVehicleDetailQuery, vehicleQueryKeys } from '@/lib/vehicle-queries';

const fuelOptions = ['Essence', 'Diesel', 'Hybride', 'Electrique'];
const conditionOptions = ['Excellent', 'Bon', 'Moyen', 'A reparer'];
const MAX_PHOTOS = 4;
const MAX_FILE_SIZE_MB = 8;
const MAX_IMAGE_DIMENSION = 1600;
const OUTPUT_IMAGE_QUALITY = 0.8;

type VehicleFormState = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  fuel: string;
  mileage: number;
  salePrice: string | number;
  rentalPrice: string | number;
  description: string;
  condition: string;
};

type VehicleFieldConfig = {
  key: keyof VehicleFormState;
  label: string;
  type: 'text' | 'number';
  required?: boolean;
  placeholder?: string;
};

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
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

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Impossible de preparer la compression de l'image.");

  ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const compressedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, OUTPUT_IMAGE_QUALITY);
  });
  if (!compressedBlob) throw new Error("La compression de l'image a echoue.");

  const extension = outputType === 'image/png' ? 'png' : 'jpg';
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  return new File([compressedBlob], `${baseName}-compressed.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}

export default function VehicleEditForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: vehicle, isLoading } = useVehicleDetailQuery(id);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [pendingPhotoPreviews, setPendingPhotoPreviews] = useState<string[]>([]);
  const [form, setForm] = useState<VehicleFormState>({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    plate: '',
    fuel: 'Essence',
    mileage: 0,
    salePrice: '',
    rentalPrice: '',
    description: '',
    condition: 'Bon',
  });

  useEffect(() => {
    if (!vehicle) return;
    setForm({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      plate: vehicle.plate,
      fuel: vehicle.fuel,
      mileage: vehicle.mileage,
      salePrice: vehicle.salePrice,
      rentalPrice: vehicle.rentalPrice,
      description: vehicle.description ?? '',
      condition: vehicle.condition,
    });
    setPhotos(vehicle.photos ?? []);
  }, [vehicle]);

  const update = (key: keyof VehicleFormState, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = useMemo(() => !submitting && !uploading, [submitting, uploading]);

  const onSelectPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const remainingSlots = MAX_PHOTOS - photos.length - pendingPhotoFiles.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos.`);
      return;
    }

    const files = selectedFiles.slice(0, remainingSlots);
    const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (tooLarge) {
      toast.error(`Chaque image doit faire moins de ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setPendingPhotoFiles((prev) => [...prev, ...files]);
    setPendingPhotoPreviews((prev) => [...prev, ...files.map((file) => URL.createObjectURL(file))]);
    toast.success(`${files.length} image(s) ajoutee(s).`);
    event.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removePendingPhoto = (index: number) => {
    setPendingPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPhotoPreviews((prev) => {
      const previewToRemove = prev[index];
      if (previewToRemove) URL.revokeObjectURL(previewToRemove);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;

    setSubmitting(true);
    try {
      setUploading(true);
      const compressedFiles = await Promise.all(pendingPhotoFiles.map((file) => compressImage(file)));
      const uploadedUrls = await Promise.all(compressedFiles.map((file) => uploadImageToR2(file)));
      const finalPhotos = [...photos, ...uploadedUrls];

      await updateVehicleRequest(id, {
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        color: form.color.trim(),
        plate: form.plate.trim(),
        fuel: form.fuel.trim(),
        mileage: Number(form.mileage),
        salePrice: Number(form.salePrice),
        rentalPrice: Number(form.rentalPrice),
        description: form.description.trim() || undefined,
        condition: form.condition.trim(),
        photos: finalPhotos,
      });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      toast.success('Vehicule modifie avec succes.');
      pendingPhotoPreviews.forEach((preview) => URL.revokeObjectURL(preview));
      navigate(`/vehicles/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier le vehicule.");
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  const fields: VehicleFieldConfig[] = [
    { key: 'brand', label: 'Marque', type: 'text', required: true, placeholder: 'Ex: Toyota' },
    { key: 'model', label: 'Modele', type: 'text', required: true, placeholder: 'Ex: RAV4' },
    { key: 'year', label: 'Annee', type: 'number' },
    { key: 'color', label: 'Couleur', type: 'text', placeholder: 'Ex: Blanc' },
    { key: 'plate', label: 'Immatriculation', type: 'text', required: true, placeholder: 'Ex: AB-123-CD' },
    { key: 'mileage', label: 'Kilometrage', type: 'number' },
    { key: 'salePrice', label: 'Prix de vente (CFA)', type: 'number', placeholder: 'Ex: 18000000' },
    { key: 'rentalPrice', label: 'Prix location/jour (CFA)', type: 'number', placeholder: 'Ex: 45000' },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
        <p className="text-muted-foreground text-lg">Chargement du vehicule...</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Vehicule introuvable</p>
        <Link to="/vehicles" className="mt-4 text-primary hover:underline text-sm">
          ← Retour a la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to={`/vehicles/${vehicle.id}`} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Modifier le vehicule</h1>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">{f.label}</label>
              <input
                type={f.type}
                required={f.required}
                disabled={!canSubmit}
                value={form[f.key]}
                placeholder={f.placeholder}
                onChange={(event) =>
                  update(
                    f.key,
                    f.type === 'number'
                      ? event.target.value === ''
                        ? ''
                        : Number(event.target.value)
                      : event.target.value,
                  )
                }
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Carburant</label>
            <select
              value={form.fuel}
              onChange={(event) => update('fuel', event.target.value)}
              disabled={!canSubmit}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              {fuelOptions.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {fuel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Etat general</label>
            <select
              value={form.condition}
              onChange={(event) => update('condition', event.target.value)}
              disabled={!canSubmit}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              {conditionOptions.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            rows={3}
            disabled={!canSubmit}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
            placeholder="Description du vehicule..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-foreground">Photos (max 4)</label>
            <span className="text-xs text-muted-foreground">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((url, index) => (
              <div key={`${url}-${index}`} className="relative aspect-square bg-secondary border border-border rounded-lg overflow-hidden">
                <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  disabled={!canSubmit}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background disabled:opacity-60"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {pendingPhotoPreviews.map((url, index) => (
              <div key={`${url}-${index}`} className="relative aspect-square bg-secondary border border-border rounded-lg overflow-hidden">
                <img src={url} alt={`Nouvelle photo ${index + 1}`} className="w-full h-full object-cover opacity-90" />
                <div className="absolute left-1 top-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-foreground">
                  En attente
                </div>
                <button
                  type="button"
                  onClick={() => removePendingPhoto(index)}
                  disabled={!canSubmit}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background disabled:opacity-60"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {photos.length + pendingPhotoFiles.length < MAX_PHOTOS && (
              <label className="aspect-square bg-secondary border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground">{uploading ? 'Upload...' : 'Ajouter'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onSelectPhotos}
                  disabled={!canSubmit}
                />
              </label>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? 'Mise a jour...' : 'Mettre a jour le vehicule'}
        </button>
      </form>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImageToR2 } from '@/lib/cloudflare-upload';
import { createVehicleRequest } from '@/lib/vehicle-api';

const fuelOptions = ['Essence', 'Diesel', 'Hybride', 'Electrique'];
const conditionOptions = ['Excellent', 'Bon', 'Moyen', 'A reparer'];
const MAX_PHOTOS = 4;
const MAX_FILE_SIZE_MB = 8;

export default function VehicleForm() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [form, setForm] = useState({
    brand: '', model: '', year: new Date().getFullYear(), color: '',
    plate: '', fuel: 'Essence', mileage: 0, salePrice: 0, rentalPrice: 0,
    description: '', condition: 'Bon',
  });

  const update = (key: string, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const canSubmit = useMemo(() => !submitting && !uploading, [submitting, uploading]);

  const onSelectPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const remainingSlots = MAX_PHOTOS - photos.length;
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

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map((file) => uploadImageToR2(file)));
      setPhotos((prev) => [...prev, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploadee(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur pendant l'upload.");
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      await createVehicleRequest({
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
        photos,
      });
      toast.success('Vehicule ajoute avec succes !');
      navigate('/vehicles');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'ajouter le vehicule.");
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    { key: 'brand', label: 'Marque', type: 'text', required: true },
    { key: 'model', label: 'Modele', type: 'text', required: true },
    { key: 'year', label: 'Annee', type: 'number' },
    { key: 'color', label: 'Couleur', type: 'text' },
    { key: 'plate', label: 'Immatriculation', type: 'text', required: true },
    { key: 'mileage', label: 'Kilometrage', type: 'number' },
    { key: 'salePrice', label: 'Prix de vente (CFA)', type: 'number' },
    { key: 'rentalPrice', label: 'Prix location/jour (CFA)', type: 'number' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vehicles" className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Ajouter un vehicule</h1>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">{f.label}</label>
              <input
                type={f.type}
                required={f.required}
                disabled={!canSubmit}
                value={(form as Record<string, string | number>)[f.key]}
                onChange={e => update(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Carburant</label>
            <select
              value={form.fuel}
              onChange={e => update('fuel', e.target.value)}
              disabled={!canSubmit}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              {fuelOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Etat general</label>
            <select
              value={form.condition}
              onChange={e => update('condition', e.target.value)}
              disabled={!canSubmit}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              {conditionOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            rows={3}
            disabled={!canSubmit}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-60"
            placeholder="Description du vehicule..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-foreground">Photos (max 4)</label>
            <span className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((url, index) => (
              <div key={url} className="relative aspect-square bg-secondary border border-border rounded-lg overflow-hidden">
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

            {photos.length < MAX_PHOTOS && (
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
          {(submitting || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? 'Enregistrement...' : 'Enregistrer le vehicule'}
        </button>
      </form>
    </div>
  );
}

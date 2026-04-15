import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

const fuelOptions = ['Essence', 'Diesel', 'Hybride', 'Électrique'];
const conditionOptions = ['Excellent', 'Bon', 'Moyen', 'À réparer'];

export default function VehicleForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    brand: '', model: '', year: new Date().getFullYear(), color: '',
    plate: '', fuel: 'Essence', mileage: 0, salePrice: 0, rentalPrice: 0,
    description: '', condition: 'Bon',
  });

  const update = (key: string, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Véhicule ajouté avec succès !');
    navigate('/vehicles');
  };

  const fields = [
    { key: 'brand', label: 'Marque', type: 'text', required: true },
    { key: 'model', label: 'Modèle', type: 'text', required: true },
    { key: 'year', label: 'Année', type: 'number' },
    { key: 'color', label: 'Couleur', type: 'text' },
    { key: 'plate', label: 'Immatriculation', type: 'text', required: true },
    { key: 'mileage', label: 'Kilométrage', type: 'number' },
    { key: 'salePrice', label: 'Prix de vente (CFA)', type: 'number' },
    { key: 'rentalPrice', label: 'Prix location/jour (CFA)', type: 'number' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vehicles" className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Ajouter un véhicule</h1>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">{f.label}</label>
              <input
                type={f.type}
                required={f.required}
                value={(form as Record<string, string | number>)[f.key]}
                onChange={e => update(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}

          {/* Fuel select */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Carburant</label>
            <select
              value={form.fuel}
              onChange={e => update('fuel', e.target.value)}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {fuelOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Condition select */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">État général</label>
            <select
              value={form.condition}
              onChange={e => update('condition', e.target.value)}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {conditionOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Description du véhicule..."
          />
        </div>

        {/* Photos placeholder */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Photos (max 4)</label>
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-secondary border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <span className="text-xs text-muted-foreground">+</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Save className="w-4 h-4" />
          Enregistrer le véhicule
        </button>
      </form>
    </div>
  );
}

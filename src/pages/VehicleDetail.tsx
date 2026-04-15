import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Car, Fuel, Gauge, Calendar, FileText } from 'lucide-react';
import { mockVehicles } from '@/data/mockVehicles';
import StatusBadge from '@/components/StatusBadge';

export default function VehicleDetail() {
  const { id } = useParams();
  const vehicle = mockVehicles.find(v => v.id === id);

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground text-lg">Véhicule introuvable</p>
        <Link to="/vehicles" className="mt-4 text-primary hover:underline text-sm">← Retour à la liste</Link>
      </div>
    );
  }

  const details = [
    { label: 'Marque', value: vehicle.brand },
    { label: 'Modèle', value: vehicle.model },
    { label: 'Année', value: vehicle.year },
    { label: 'Couleur', value: vehicle.color },
    { label: 'Immatriculation', value: vehicle.plate },
    { label: 'Carburant', value: vehicle.fuel },
    { label: 'Kilométrage', value: `${vehicle.mileage.toLocaleString()} km` },
    { label: 'État', value: vehicle.condition },
    { label: 'Prix de vente', value: `${vehicle.salePrice.toLocaleString()} €` },
    { label: 'Prix location/jour', value: `${vehicle.rentalPrice} €` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vehicles" className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-muted-foreground text-sm">{vehicle.plate} · Ajouté le {vehicle.createdAt}</p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      {/* Photo area */}
      <div className="glass-card h-64 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Car className="w-16 h-16 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucune photo disponible</p>
        </div>
      </div>

      {/* Details grid */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Informations</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {details.map(d => (
            <div key={d.label}>
              <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
              <p className="text-sm font-medium text-foreground">{d.value}</p>
            </div>
          ))}
        </div>
        {vehicle.description && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground">{vehicle.description}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {vehicle.status === 'available' && (
          <>
            <button className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Déclarer vendu
            </button>
            <button className="px-4 py-2.5 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Mettre en location
            </button>
            <button className="px-4 py-2.5 bg-warning text-warning-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              En réparation
            </button>
          </>
        )}
        {vehicle.status === 'repair' && (
          <button className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Réparation terminée
          </button>
        )}
        {vehicle.status === 'rented' && (
          <button className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Fin de location
          </button>
        )}
      </div>
    </div>
  );
}

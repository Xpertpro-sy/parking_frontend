import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Car, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/StatusBadge';
import { useVehicleDetailQuery } from '@/lib/vehicle-queries';

export default function VehicleDetail() {
  const { id } = useParams();
  const { data: vehicle, isLoading, isError, error } = useVehicleDetailQuery(id);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger le vehicule.");
    }
  }, [isError, error]);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [vehicle?.id]);

  useEffect(() => {
    if (!vehicle || vehicle.photos.length <= 1) return;

    const timer = window.setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % vehicle.photos.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [vehicle]);

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
        <p className="text-muted-foreground text-lg">Véhicule introuvable</p>
        <Link to="/vehicles" className="mt-4 text-primary hover:underline text-sm">← Retour à la liste</Link>
      </div>
    );
  }

  const details = [
    { label: 'Marque', value: vehicle.brand },
    { label: 'Modele', value: vehicle.model },
    { label: 'Annee', value: vehicle.year },
    { label: 'Couleur', value: vehicle.color },
    { label: 'Immatriculation', value: vehicle.plate },
    { label: 'Carburant', value: vehicle.fuel },
    { label: 'Kilometrage', value: `${vehicle.mileage.toLocaleString()} km` },
    { label: 'Etat', value: vehicle.condition },
    { label: 'Prix de vente', value: `${vehicle.salePrice.toLocaleString()} CFA` },
    { label: 'Prix location/jour', value: `${vehicle.rentalPrice.toLocaleString()} CFA` },
  ];

  const hasMultiplePhotos = vehicle.photos.length > 1;
  const currentPhoto = vehicle.photos[currentPhotoIndex];

  const goToPreviousPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + vehicle.photos.length) % vehicle.photos.length);
  };

  const goToNextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % vehicle.photos.length);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/vehicles" className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-muted-foreground text-sm">
            {vehicle.plate} · Ajoute le {new Date(vehicle.createdAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {vehicle.status === 'available' && (
          <>
            <Link
              to={`/sales/new?vehicleId=${vehicle.id}`}
              className="px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Vendre
            </Link>
            <button className="px-4 py-2.5 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Louer
            </button>
            <button className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors">
              Réserver
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

      {/* Photos */}
      {vehicle.photos.length > 0 ? (
        <div className="glass-card p-3 space-y-3">
          <div className="relative">
            <img
              src={currentPhoto}
              alt={`${vehicle.brand} ${vehicle.model} - photo ${currentPhotoIndex + 1}`}
              className="h-80 md:h-96 w-full object-cover rounded-lg"
            />

            {hasMultiplePhotos && (
              <>
                <button
                  type="button"
                  onClick={goToPreviousPhoto}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground" />
                </button>
                <button
                  type="button"
                  onClick={goToNextPhoto}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-background transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-foreground" />
                </button>
              </>
            )}
          </div>

          {hasMultiplePhotos && (
            <div className="flex items-center justify-center gap-2">
              {vehicle.photos.map((photoUrl, index) => (
                <button
                  key={`${photoUrl}-${index}`}
                  type="button"
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    currentPhotoIndex === index ? 'w-6 bg-primary' : 'w-2.5 bg-muted'
                  }`}
                  aria-label={`Afficher la photo ${index + 1}`}
                />
              ))}
            </div>
          )}

          {vehicle.photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {vehicle.photos.map((photoUrl, index) => (
                <button
                  key={`thumb-${photoUrl}-${index}`}
                  type="button"
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`overflow-hidden rounded-md border ${
                    currentPhotoIndex === index ? 'border-primary' : 'border-border'
                  }`}
                >
                  <img
                    src={photoUrl}
                    alt={`Miniature ${index + 1}`}
                    className="h-16 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground text-center">
            Photo {currentPhotoIndex + 1} / {vehicle.photos.length}
          </div>
        </div>
      ) : (
        <div className="glass-card h-64 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Car className="w-16 h-16 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucune photo disponible</p>
          </div>
        </div>
      )}

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
    </div>
  );
}

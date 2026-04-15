import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { listRentalsRequest } from '@/lib/rental-api';

export default function RentedVehicles() {
  const { data: rentals = [], isLoading, isError, error } = useQuery({
    queryKey: ['rentals', 'list'],
    queryFn: listRentalsRequest,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger les locations.');
    }
  }, [isError, error]);

  const activeRentals = rentals
    .filter((rental) => rental.status?.toLowerCase() === 'active')
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Voitures louees</h1>
        <p className="text-muted-foreground mt-1">Locations actives en cours</p>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Chargement des locations...</p>
        </div>
      ) : activeRentals.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {activeRentals.map((rental) => (
            <div key={rental.id} className="glass-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Vehicule</p>
                  <Link to={`/vehicles/${rental.vehicleId}`} className="text-sm font-semibold text-foreground hover:underline">
                    Voir vehicule
                  </Link>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-info/10 text-info">
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Locataire</p>
                  <p className="text-foreground font-medium">{rental.tenantName}</p>
                  <p className="text-xs text-muted-foreground">{rental.tenantPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Periode (date + heure)</p>
                  <p className="text-foreground">
                    {new Date(rental.startDate).toLocaleString()} - {new Date(rental.endDate).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duree</p>
                  <p className="text-foreground font-medium">{rental.totalDays} jour(s)</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="text-foreground font-semibold">{rental.amount.toLocaleString()} CFA</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Numero CNI</p>
                  <p className="text-foreground">{rental.tenantIdCardNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Photo CNI</p>
                  {rental.tenantIdCardPhotoUrl ? (
                    <a
                      href={rental.tenantIdCardPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Voir photo
                    </a>
                  ) : (
                    <p className="text-muted-foreground">Non fournie</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Adresse locataire</p>
                  <p className="text-foreground">{rental.tenantAddress || 'Non renseignee'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact urgence</p>
                  <p className="text-foreground">
                    {rental.emergencyContactName || 'Non renseigne'}
                    {rental.emergencyContactPhone ? ` - ${rental.emergencyContactPhone}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prix / jour</p>
                  <p className="text-foreground">{rental.dailyPrice.toLocaleString()} CFA</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Caution</p>
                  <p className="text-foreground">
                    {rental.depositAmount !== null ? `${rental.depositAmount.toLocaleString()} CFA` : 'Aucune'}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Cree le {new Date(rental.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Car className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucune voiture louee actuellement.</p>
        </div>
      )}
    </div>
  );
}

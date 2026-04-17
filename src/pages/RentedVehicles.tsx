import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { listRentalsRequest } from '@/lib/rental-api';

const formatDateTimeFr = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export default function RentedVehicles() {
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    const saved = window.localStorage.getItem('rented-vehicles-view');
    return saved === 'list' ? 'list' : 'cards';
  });
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

  useEffect(() => {
    window.localStorage.setItem('rented-vehicles-view', viewMode);
  }, [viewMode]);

  const activeRentals = rentals
    .filter((rental) => rental.status?.toLowerCase() === 'active')
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Voitures louees</h1>
          <p className="text-muted-foreground mt-1">Locations actives en cours</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            }`}
          >
            Cadres
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            }`}
          >
            Liste
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Chargement des locations...</p>
        </div>
      ) : activeRentals.length > 0 ? (
        viewMode === 'cards' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeRentals.map((rental) => (
              <div key={rental.id} className="glass-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Vehicule</p>
                    <Link to={`/vehicles/${rental.vehicleId}`} className="text-sm font-semibold text-foreground hover:underline">
                      {rental.vehicleBrand} {rental.vehicleModel}
                    </Link>
                    <p className="text-xs text-muted-foreground">{rental.vehiclePlate}</p>
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
                      {formatDateTimeFr(rental.startDate)} - {formatDateTimeFr(rental.endDate)}
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
                </div>

                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Cree le {formatDateTimeFr(rental.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 text-muted-foreground font-medium">Vehicule</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium">Locataire</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium">Periode</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium">Duree</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium">Montant</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium">Prix/jour</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {activeRentals.map((rental) => (
                  <tr key={rental.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <Link to={`/vehicles/${rental.vehicleId}`} className="font-medium hover:underline">
                        {rental.vehicleBrand} {rental.vehicleModel}
                      </Link>
                      <p className="text-xs text-muted-foreground">{rental.vehiclePlate}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{rental.tenantName}</p>
                      <p className="text-xs text-muted-foreground">{rental.tenantPhone}</p>
                    </td>
                    <td className="px-3 py-2">
                      {formatDateTimeFr(rental.startDate)} - {formatDateTimeFr(rental.endDate)}
                    </td>
                    <td className="px-3 py-2">{rental.totalDays} jour(s)</td>
                    <td className="px-3 py-2 font-semibold">{rental.amount.toLocaleString()} CFA</td>
                    <td className="px-3 py-2">{rental.dailyPrice.toLocaleString()} CFA</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-info/10 text-info">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="glass-card p-12 text-center">
          <Car className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucune voiture louee actuellement.</p>
        </div>
      )}
    </div>
  );
}

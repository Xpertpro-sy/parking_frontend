import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { listRentalsRequest } from '@/lib/rental-api';

const formatDateTimeFr = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export default function HistoryPage() {
  const { data: rentals = [], isLoading, isError, error } = useQuery({
    queryKey: ['rentals', 'list'],
    queryFn: listRentalsRequest,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger l'historique.");
    }
  }, [isError, error]);

  const orderedRentals = [...rentals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Historique</h1>
        <p className="text-muted-foreground mt-1">Historique des locations enregistrees</p>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Chargement de l'historique...</p>
        </div>
      ) : orderedRentals.length > 0 ? (
        <div className="space-y-3">
          {orderedRentals.map((rental) => {
            const isCompleted = rental.status?.toLowerCase() === 'completed';
            return (
              <div key={rental.id} className="glass-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Location - <Link to={`/vehicles/${rental.vehicleId}`} className="hover:underline">{rental.vehicleBrand} {rental.vehicleModel}</Link>
                    </p>
                    <p className="text-xs text-muted-foreground">{rental.vehiclePlate}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeFr(rental.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      isCompleted ? 'bg-success/10 text-success' : 'bg-info/10 text-info'
                    }`}
                  >
                    {isCompleted ? 'Terminee' : 'Active'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Locataire</p>
                    <p className="text-foreground font-medium">{rental.tenantName}</p>
                    <p className="text-xs text-muted-foreground">{rental.tenantPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Periode (date + heure)</p>
                    <p className="text-foreground">{formatDateTimeFr(rental.startDate)} - {formatDateTimeFr(rental.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duree</p>
                    <p className="text-foreground">{rental.totalDays} jour(s)</p>
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
                  <div>
                    <p className="text-xs text-muted-foreground">Fin de location</p>
                    <p className="text-foreground">
                      {rental.completedAt ? formatDateTimeFr(rental.completedAt) : 'Pas encore terminee'}
                    </p>
                  </div>
                </div>

                {rental.receipt && (
                  <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Details du recu</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Numero recu</p>
                        <p className="text-foreground font-medium">{rental.receipt.receiptNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vehicule</p>
                        <p className="text-foreground">
                          {rental.receipt.vehicleBrand} {rental.receipt.vehicleModel}
                        </p>
                        <p className="text-xs text-muted-foreground">{rental.receipt.vehiclePlate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Montant recu</p>
                        <p className="text-foreground font-semibold">
                          {rental.receipt.rentalAmount.toLocaleString()} CFA
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Periode recu</p>
                        <p className="text-foreground">
                          {formatDateTimeFr(rental.receipt.startDate)} - {formatDateTimeFr(rental.receipt.endDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Caution recu</p>
                        <p className="text-foreground">
                          {rental.receipt.depositAmount !== null
                            ? `${rental.receipt.depositAmount.toLocaleString()} CFA`
                            : 'Aucune'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Recu emis le</p>
                        <p className="text-foreground">{formatDateTimeFr(rental.receipt.issuedAt)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <History className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucune location enregistree.</p>
          <p className="text-sm text-muted-foreground mt-1">L'historique apparaitra ici apres les prochaines locations.</p>
        </div>
      )}
    </div>
  );
}

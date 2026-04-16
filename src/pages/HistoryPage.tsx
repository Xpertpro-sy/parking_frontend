import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { listRentalsRequest } from '@/lib/rental-api';
import { listReservationsRequest } from '@/lib/vehicle-action-api';

const formatDateTimeFr = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export default function HistoryPage() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'custom' | 'all'>('30d');
  const [typeFilter, setTypeFilter] = useState<'all' | 'reservation' | 'location'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { data: rentals = [], isLoading: loadingRentals, isError: rentalError, error: rentalErrorValue } = useQuery({
    queryKey: ['rentals', 'list'],
    queryFn: listRentalsRequest,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: reservations = [], isLoading: loadingReservations, isError: reservationError, error: reservationErrorValue } = useQuery({
    queryKey: ['reservations', 'list'],
    queryFn: listReservationsRequest,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (rentalError) {
      toast.error(rentalErrorValue instanceof Error ? rentalErrorValue.message : "Impossible de charger l'historique des locations.");
    }
    if (reservationError) {
      toast.error(reservationErrorValue instanceof Error ? reservationErrorValue.message : "Impossible de charger l'historique des reservations.");
    }
  }, [rentalError, rentalErrorValue, reservationError, reservationErrorValue]);

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'all') return null;
    if (period === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return start;
    }
    if (period === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (period === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (!customStart) return null;
    const start = new Date(customStart);
    return Number.isNaN(start.getTime()) ? null : start;
  }, [period, customStart]);

  const periodEnd = useMemo(() => {
    if (period !== 'custom') return null;
    if (!customEnd) return null;
    const end = new Date(customEnd);
    if (Number.isNaN(end.getTime())) return null;
    end.setHours(23, 59, 59, 999);
    return end;
  }, [period, customEnd]);

  const isInRange = (value: string) => {
    const createdAt = new Date(value);
    if (Number.isNaN(createdAt.getTime())) return false;
    if (periodStart && createdAt < periodStart) return false;
    if (periodEnd && createdAt > periodEnd) return false;
    return true;
  };

  const filteredRentals = rentals.filter((item) => isInRange(item.createdAt));
  const filteredReservations = reservations.filter((item) => isInRange(item.createdAt));

  const timelineItems = useMemo(() => {
    const reservationItems = filteredReservations.map((reservation) => ({
      kind: 'reservation' as const,
      createdAt: reservation.createdAt,
      id: reservation.id,
      payload: reservation,
    }));
    const rentalItems = filteredRentals.map((rental) => ({
      kind: 'location' as const,
      createdAt: rental.createdAt,
      id: rental.id,
      payload: rental,
    }));
    return [...reservationItems, ...rentalItems]
      .filter((item) => typeFilter === 'all' || item.kind === typeFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filteredReservations, filteredRentals, typeFilter]);

  const isLoading = loadingRentals || loadingReservations;
  const activeReservationsCount = filteredReservations.filter((item) => item.status === 'ACTIVE').length;
  const completedRentalsCount = filteredRentals.filter((item) => item.status?.toLowerCase() === 'completed').length;
  const totalRevenue = filteredRentals.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-info/10 to-purple-500/10 p-5 md:p-6">
        <h1 className="text-2xl font-bold text-foreground">Historique des operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivi professionnel des reservations et locations avec details clients, montants et statuts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-cyan-200/40 bg-cyan-500/5 dark:border-cyan-800/40 dark:bg-cyan-900/20 p-4">
          <p className="text-xs font-medium text-white">Reservations actives</p>
          <p className="mt-1 text-2xl font-bold text-white">{activeReservationsCount}</p>
        </div>
        <div className="rounded-xl border border-info/30 bg-info/10 p-4">
          <p className="text-xs font-medium text-info">Locations terminees</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{completedRentalsCount}</p>
        </div>
        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="text-xs font-medium text-success">Montant total locations</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalRevenue.toLocaleString()} CFA</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'today', label: "Aujourd'hui" },
            { key: '7d', label: '7 jours' },
            { key: '30d', label: '30 jours' },
            { key: 'custom', label: 'Personnalise' },
            { key: 'all', label: 'Tout' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key as typeof period)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === option.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date debut</label>
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date fin</label>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Tout afficher' },
            { key: 'reservation', label: 'Reservations' },
            { key: 'location', label: 'Locations' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setTypeFilter(option.key as typeof typeFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === option.key ? 'bg-info text-info-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Chargement de l'historique...</p>
        </div>
      ) : timelineItems.length > 0 ? (
        <div className="space-y-3">
          {timelineItems.map((entry) => {
            if (entry.kind === 'reservation') {
              const reservation = entry.payload;
              const isActive = reservation.status === 'ACTIVE';
              const isCancelled = reservation.status === 'CANCELLED';
              return (
                <div key={`reservation-${reservation.id}`} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">
                      Reservation
                    </span>
                    <p className="text-xs text-muted-foreground">{formatDateTimeFr(reservation.createdAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        <Link to={`/vehicles/${reservation.vehicleId}`} className="hover:underline">{reservation.vehicleBrand} {reservation.vehicleModel}</Link>
                      </p>
                      <p className="text-xs text-muted-foreground">Plaque: {reservation.vehiclePlate}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        isActive ? 'bg-purple-100 text-purple-700' : isCancelled ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                      }`}
                    >
                      {isActive ? 'Reserve' : isCancelled ? 'Annulee' : 'Completee'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Client</p>
                      <p className="text-foreground font-medium">{reservation.customerName}</p>
                      <p className="text-xs text-muted-foreground">{reservation.customerPhone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Jour de reservation</p>
                      <p className="text-foreground">{new Date(reservation.reservationDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Montant paye</p>
                      <p className="text-foreground font-semibold">{reservation.amountPaid.toLocaleString()} CFA</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-foreground">{reservation.notes || 'Aucune'}</p>
                    </div>
                  </div>
                </div>
              );
            }

            const rental = entry.payload;
            const isCompleted = rental.status?.toLowerCase() === 'completed';
            return (
              <div key={`rental-${rental.id}`} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-info/15 text-info">
                    Location
                  </span>
                  <p className="text-xs text-muted-foreground">{formatDateTimeFr(rental.createdAt)}</p>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      <Link to={`/vehicles/${rental.vehicleId}`} className="hover:underline">{rental.vehicleBrand} {rental.vehicleModel}</Link>
                    </p>
                    <p className="text-xs text-muted-foreground">Plaque: {rental.vehiclePlate}</p>
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
                    <p className="text-xs text-muted-foreground">Periode</p>
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
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
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
                    <p className="text-xs text-muted-foreground">Fin de location</p>
                    <p className="text-foreground">
                      {rental.completedAt ? formatDateTimeFr(rental.completedAt) : 'Pas encore terminee'}
                    </p>
                  </div>
                </div>

                {rental.receipt && (
                  <div className="mt-3 rounded-lg border border-info/20 bg-info/5 p-3">
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
          <p className="text-muted-foreground">Aucune operation enregistree.</p>
          <p className="text-sm text-muted-foreground mt-1">L'historique apparaitra ici apres les prochaines locations ou reservations.</p>
        </div>
      )}
    </div>
  );
}

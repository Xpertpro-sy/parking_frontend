import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cancelReservationRequest, listReservationsRequest } from '@/lib/vehicle-action-api';
import { vehicleQueryKeys } from '@/lib/vehicle-queries';

const formatDateFr = (value: string) =>
  new Date(value).toLocaleDateString('fr-FR', {
    dateStyle: 'short',
  });

type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year';

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois en cours' },
  { value: 'year', label: 'Année' },
];

const ITEMS_PER_PAGE = 8;

export default function ReservedVehicles() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    const saved = window.localStorage.getItem('reserved-vehicles-view');
    return saved === 'list' ? 'list' : 'cards';
  });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week');
  const [currentPage, setCurrentPage] = useState(1);
  const { data: reservations = [], isLoading, isError, error } = useQuery({
    queryKey: ['reservations', 'list'],
    queryFn: listReservationsRequest,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger les reservations.');
    }
  }, [isError, error]);

  useEffect(() => {
    window.localStorage.setItem('reserved-vehicles-view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeReservations = reservations.filter((reservation) => reservation.status === 'ACTIVE');
  const filteredReservations = activeReservations.filter((reservation) => {
    const date = new Date(reservation.reservationDate);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    if (periodFilter === 'today') return isSameDay(date, now);
    if (periodFilter === 'yesterday') return isSameDay(date, yesterday);
    if (periodFilter === 'week') return date >= weekStart;
    if (periodFilter === 'month') return date >= monthStart;
    return date >= yearStart;
  });
  const totalPages = Math.max(1, Math.ceil(filteredReservations.length / ITEMS_PER_PAGE));
  const paginatedReservations = filteredReservations.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [periodFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const onCancelReservation = async (vehicleId: string) => {
    try {
      await cancelReservationRequest(vehicleId);
      await queryClient.invalidateQueries({ queryKey: ['reservations', 'list'] });
      await queryClient.invalidateQueries({ queryKey: vehicleQueryKeys.all });
      toast.success('Reservation annulee avec succes.');
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : "Impossible d'annuler la reservation.");
    }
  };

  const goToFinalizeRental = (vehicleId: string) => {
    navigate(`/rentals/finalize-from-reservation?vehicleId=${vehicleId}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Voitures reservees</h1>
          <p className="text-muted-foreground mt-1">Reservations actives des clients</p>
        </div>
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 sm:justify-end">
          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-secondary text-sm"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
            className={`hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium ${
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            }`}
          >
            Liste
          </button>
          <p className="text-xs text-muted-foreground whitespace-nowrap ml-1">
            {filteredReservations.length} resultat(s)
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Chargement des reservations...</p>
        </div>
      ) : filteredReservations.length > 0 ? (
        viewMode === 'cards' || isMobile ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paginatedReservations.map((reservation) => (
              <div key={reservation.id} className="glass-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Vehicule</p>
                    <Link to={`/vehicles/${reservation.vehicleId}`} className="text-sm font-semibold text-foreground hover:underline">
                      {reservation.vehicleBrand} {reservation.vehicleModel}
                    </Link>
                    <p className="text-xs text-muted-foreground">{reservation.vehiclePlate}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    Reserve
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Client</p>
                    <p className="text-foreground font-medium">{reservation.customerName}</p>
                    <p className="text-xs text-muted-foreground">{reservation.customerPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jour demande</p>
                    <p className="text-foreground">{formatDateFr(reservation.reservationDate)}</p>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => goToFinalizeRental(reservation.vehicleId)}
                    className="w-full px-4 py-2.5 bg-info text-info-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Louer maintenant
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancelReservation(reservation.vehicleId)}
                    className="w-full px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Annuler reservation
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 text-muted-foreground font-medium w-[24%]">Vehicule</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium w-[20%]">Client</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium w-[12%]">Date</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium w-[14%]">Montant</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium w-[16%]">Notes</th>
                  <th className="px-3 py-2 text-muted-foreground font-medium w-[14%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReservations.map((reservation) => (
                  <tr key={reservation.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <Link to={`/vehicles/${reservation.vehicleId}`} className="font-medium hover:underline block truncate">
                        {reservation.vehicleBrand} {reservation.vehicleModel}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">{reservation.vehiclePlate}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium truncate">{reservation.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{reservation.customerPhone}</p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateFr(reservation.reservationDate)}</td>
                    <td className="px-3 py-2 font-semibold">{reservation.amountPaid.toLocaleString()} CFA</td>
                    <td className="px-3 py-2 truncate">{reservation.notes || 'Aucune'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => goToFinalizeRental(reservation.vehicleId)}
                          className="px-3 py-1.5 bg-info text-info-foreground rounded-md text-xs font-medium"
                        >
                          Louer
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancelReservation(reservation.vehicleId)}
                          className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md text-xs font-medium"
                        >
                          Annuler
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="glass-card p-12 text-center">
          <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucune reservation active.</p>
        </div>
      )}

      {filteredReservations.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Affichage {(currentPage - 1) * ITEMS_PER_PAGE + 1}
            {' - '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredReservations.length)} sur {filteredReservations.length}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              <ChevronLeft className="h-4 w-4" />
              Precedent
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

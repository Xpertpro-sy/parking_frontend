import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, History, Loader2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { listRentalsRequest } from '@/lib/rental-api';
import { listReservationsRequest } from '@/lib/vehicle-action-api';
import { listSalesRequest } from '@/lib/sale-api';
import {
  moveRentalHistoryToTrashRequest,
  moveReservationHistoryToTrashRequest,
  trashItemsQueryKey,
} from '@/lib/trash-api';
import { LIVE_COLLAB_REFETCH_MS } from '@/lib/vehicle-queries';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import FullscreenLoader from '@/components/ui/fullscreen-loader';
import { getCurrentUserAccessProfile } from '@/lib/access-control';

type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year';

const HISTORY_ITEMS_PER_PAGE = 10;

const PERIOD_OPTIONS: { key: PeriodFilter; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois en cours' },
  { key: 'year', label: 'Année' },
];

const formatDateTimeFr = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const { data: accessProfile } = useQuery({
    queryKey: ['access-profile'],
    queryFn: getCurrentUserAccessProfile,
  });
  const canUseTrash =
    accessProfile?.role === 'ADMIN' ||
    accessProfile?.role === 'SUPER_ADMIN' ||
    accessProfile?.permissions?.trash === true;
  const [pendingDelete, setPendingDelete] = useState<
    { type: 'reservation' | 'rental'; id: string; label: string } | null
  >(null);
  const [isDeletingHistoryItem, setIsDeletingHistoryItem] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>('week');
  const [typeFilter, setTypeFilter] = useState<'all' | 'reservation' | 'location'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: rentals = [], isLoading: loadingRentals, isError: rentalError, error: rentalErrorValue } = useQuery({
    queryKey: ['rentals', 'list'],
    queryFn: listRentalsRequest,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
  const { data: reservations = [], isLoading: loadingReservations, isError: reservationError, error: reservationErrorValue } = useQuery({
    queryKey: ['reservations', 'list'],
    queryFn: listReservationsRequest,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
  const { data: sales = [], isLoading: loadingSales, isError: salesError, error: salesErrorValue } = useQuery({
    queryKey: ['sales', 'list'],
    queryFn: listSalesRequest,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (rentalError) {
      toast.error(rentalErrorValue instanceof Error ? rentalErrorValue.message : "Impossible de charger l'historique des locations.");
    }
    if (reservationError) {
      toast.error(reservationErrorValue instanceof Error ? reservationErrorValue.message : "Impossible de charger l'historique des reservations.");
    }
    if (salesError) {
      toast.error(salesErrorValue instanceof Error ? salesErrorValue.message : "Impossible de charger l'historique des ventes.");
    }
  }, [rentalError, rentalErrorValue, reservationError, reservationErrorValue, salesError, salesErrorValue]);

  const isInRange = (value: string) => {
    const date = new Date(value);
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

    if (period === 'today') return isSameDay(date, now);
    if (period === 'yesterday') return isSameDay(date, yesterday);
    if (period === 'week') return date >= weekStart;
    if (period === 'month') return date >= monthStart;
    return date >= yearStart;
  };

  const filteredRentals = rentals.filter((item) => isInRange(item.createdAt));
  const filteredReservations = reservations.filter((item) => isInRange(item.createdAt));
  const filteredSales = sales.filter((item) => isInRange(item.createdAt));

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

  const totalPages = Math.max(1, Math.ceil(timelineItems.length / HISTORY_ITEMS_PER_PAGE));

  const paginatedTimelineItems = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * HISTORY_ITEMS_PER_PAGE;
    return timelineItems.slice(startIndex, startIndex + HISTORY_ITEMS_PER_PAGE);
  }, [currentPage, timelineItems, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [period, typeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const isLoading = loadingRentals || loadingReservations || loadingSales;
  const activeReservationsCount = filteredReservations.filter((item) => item.status === 'ACTIVE').length;
  const completedRentalsCount = filteredRentals.filter((item) => item.status?.toLowerCase() === 'completed').length;
  const totalRevenue = filteredRentals.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
  const totalReservationsAmount = filteredReservations.reduce(
    (sum, item) => sum + (Number.isFinite(item.amountPaid) ? item.amountPaid : 0),
    0,
  );

  const onDeleteReservationHistory = async (reservationId: string) => {
    if (!canUseTrash) {
      toast.error("Vous n'avez pas accès à la corbeille.");
      return;
    }
    try {
      await moveReservationHistoryToTrashRequest(reservationId);
      await queryClient.invalidateQueries({ queryKey: ['reservations', 'list'] });
      await queryClient.invalidateQueries({ queryKey: trashItemsQueryKey });
      toast.success('Réservation déplacée dans la corbeille.');
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec de la suppression.');
    }
  };

  const onDeleteRentalHistory = async (rentalId: string) => {
    if (!canUseTrash) {
      toast.error("Vous n'avez pas accès à la corbeille.");
      return;
    }
    try {
      await moveRentalHistoryToTrashRequest(rentalId);
      await queryClient.invalidateQueries({ queryKey: ['rentals', 'list'] });
      await queryClient.invalidateQueries({ queryKey: trashItemsQueryKey });
      toast.success('Location déplacée dans la corbeille.');
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec de la suppression.');
    }
  };

  const onConfirmDelete = async () => {
    if (!canUseTrash) {
      toast.error("Vous n'avez pas accès à la corbeille.");
      setPendingDelete(null);
      return;
    }
    if (!pendingDelete || isDeletingHistoryItem) return;
    setIsDeletingHistoryItem(true);
    try {
      if (pendingDelete.type === 'reservation') {
        await onDeleteReservationHistory(pendingDelete.id);
        return;
      }
      await onDeleteRentalHistory(pendingDelete.id);
    } finally {
      setIsDeletingHistoryItem(false);
    }
  };

  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-info/10 to-purple-500/10 p-5 md:p-6">
        <h1 className="text-2xl font-bold text-foreground">Historique des operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivi professionnel des reservations et locations avec details clients, montants et statuts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
        <div className="rounded-xl border border-violet-300/30 bg-violet-500/10 p-4">
          <p className="text-xs font-medium text-violet-700">Montant total reservations</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalReservationsAmount.toLocaleString()} CFA</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
            className="w-full md:w-auto px-3 py-2 rounded-lg border border-border bg-secondary text-sm"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
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
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Chargement de l'historique...</p>
        </div>
      ) : timelineItems.length > 0 ? (
        <>
          <div className="space-y-3">
          {paginatedTimelineItems.map((entry) => {
            if (entry.kind === 'reservation') {
              const reservation = entry.payload;
              const isActive = reservation.status === 'ACTIVE';
              const isCancelled = reservation.status === 'CANCELLED';
              return (
                <div key={`reservation-${reservation.id}`} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700">
                      Reservation
                    </span>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{formatDateTimeFr(reservation.createdAt)}</p>
                    {canUseTrash && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            type: 'reservation',
                            id: reservation.id,
                            label: `Réservation ${reservation.customerName}`,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-destructive/40 text-destructive text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Corbeille
                      </button>
                    )}
                  </div>
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

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
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
                    <div>
                      <p className="text-xs text-muted-foreground">Ajoute par</p>
                      <p className="text-foreground">{reservation.createdByName}</p>
                    </div>
                  </div>
                </div>
              );
            }

            const rental = entry.payload;
            const isCompleted = rental.status?.toLowerCase() === 'completed';
            return (
              <div key={`rental-${rental.id}`} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-info/15 text-info">
                    Location
                  </span>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{formatDateTimeFr(rental.createdAt)}</p>
                    {canUseTrash && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            type: 'rental',
                            id: rental.id,
                            label: `Location ${rental.tenantName}`,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-destructive/40 text-destructive text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Corbeille
                      </button>
                    )}
                  </div>
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

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
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

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
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
                  <div>
                    <p className="text-xs text-muted-foreground">Ajoute par</p>
                    <p className="text-foreground">{rental.createdByName}</p>
                  </div>
                </div>

                {rental.receipt && (
                  <div className="mt-2 rounded-lg border border-info/20 bg-info/5 p-2.5">
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
          {timelineItems.length > HISTORY_ITEMS_PER_PAGE && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Affichage {(currentPage - 1) * HISTORY_ITEMS_PER_PAGE + 1}
                {' - '}
                {Math.min(currentPage * HISTORY_ITEMS_PER_PAGE, timelineItems.length)} sur {timelineItems.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Precedent
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass-card p-12 text-center">
          <History className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucune operation enregistree.</p>
          <p className="text-sm text-muted-foreground mt-1">L'historique apparaitra ici apres les prochaines locations ou reservations.</p>
        </div>
      )}

      <AlertDialog
        open={canUseTrash && Boolean(pendingDelete)}
        onOpenChange={(open) => !open && !isDeletingHistoryItem && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer à la corbeille</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous envoyer {pendingDelete?.label ?? 'cet élément'} dans la corbeille ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingHistoryItem}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} disabled={isDeletingHistoryItem}>
              {isDeletingHistoryItem ? 'Suppression...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isDeletingHistoryItem && (
        <FullscreenLoader message="Mise en corbeille en cours..." />
      )}
    </div>
  );
}

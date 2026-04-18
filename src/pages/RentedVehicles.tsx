import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Car, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { listRentalsRequest } from '@/lib/rental-api';
import { LIVE_COLLAB_REFETCH_MS } from '@/lib/vehicle-queries';

const formatDateTimeFr = (value: string) =>
  new Date(value).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
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

export default function RentedVehicles() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    if (typeof window === 'undefined') return 'cards';
    const saved = window.localStorage.getItem('rented-vehicles-view');
    return saved === 'list' ? 'list' : 'cards';
  });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week');
  const [currentPage, setCurrentPage] = useState(1);
  const { data: rentals = [], isLoading, isError, error } = useQuery({
    queryKey: ['rentals', 'list'],
    queryFn: listRentalsRequest,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger les locations.');
    }
  }, [isError, error]);

  useEffect(() => {
    window.localStorage.setItem('rented-vehicles-view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeRentals = rentals
    .filter((rental) => rental.status?.toLowerCase() === 'active')
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const filteredRentals = activeRentals.filter((rental) => {
    const date = new Date(rental.startDate);
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
  const totalPages = Math.max(1, Math.ceil(filteredRentals.length / ITEMS_PER_PAGE));
  const paginatedRentals = filteredRentals.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [periodFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Voitures louees</h1>
          <p className="text-muted-foreground mt-1">Locations actives en cours</p>
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
            {filteredRentals.length} resultat(s)
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary mb-3" />
          <p className="text-muted-foreground">Chargement des locations...</p>
        </div>
      ) : filteredRentals.length > 0 ? (
        viewMode === 'cards' || isMobile ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paginatedRentals.map((rental) => (
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 text-sm">
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
                  <p className="text-xs text-muted-foreground">Ajoute par: {rental.createdByName}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
            {paginatedRentals.map((rental) => (
              <div
                key={rental.id}
                className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1.1fr_1.5fr_0.8fr_1fr_0.9fr] gap-3 items-start"
              >
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Vehicule</p>
                  <Link to={`/vehicles/${rental.vehicleId}`} className="font-medium hover:underline block truncate">
                    {rental.vehicleBrand} {rental.vehicleModel}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">{rental.vehiclePlate}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Locataire</p>
                  <p className="font-medium truncate">{rental.tenantName}</p>
                  <p className="text-xs text-muted-foreground truncate">{rental.tenantPhone}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Periode</p>
                  <p className="truncate">{formatDateTimeFr(rental.startDate)} - {formatDateTimeFr(rental.endDate)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Duree</p>
                  <p>{rental.totalDays} jour(s)</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Montant</p>
                  <p className="font-semibold whitespace-nowrap">{rental.amount.toLocaleString()} CFA</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Statut</p>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-info/10 text-info">Active</span>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Ajoute par</p>
                  <p className="truncate">{rental.createdByName}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="glass-card p-12 text-center">
          <Car className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucune voiture louee actuellement.</p>
        </div>
      )}

      {filteredRentals.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Affichage {(currentPage - 1) * ITEMS_PER_PAGE + 1}
            {' - '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredRentals.length)} sur {filteredRentals.length}
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

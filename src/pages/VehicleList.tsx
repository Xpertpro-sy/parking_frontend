import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { VehicleStatus, STATUS_LABELS } from '@/types/vehicle';
import VehicleCard from '@/components/VehicleCard';
import { LIVE_COLLAB_REFETCH_MS, useVehiclesQuery } from '@/lib/vehicle-queries';
import { moveVehicleToTrashRequest } from '@/lib/trash-api';
import { listReservationsRequest } from '@/lib/vehicle-action-api';
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

const statusFilters: (VehicleStatus | 'all')[] = ['all', 'available', 'sold', 'rented', 'repair', 'reserved'];

/** Compare le jour civil local de la date de réservation (ISO) avec aujourd’hui. */
function isReservationDueToday(reservationDateIso: string): boolean {
  const target = new Date(reservationDateIso);
  if (Number.isNaN(target.getTime())) return false;
  const now = new Date();
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  );
}

export default function VehicleList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<VehicleStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [pendingDeleteVehicle, setPendingDeleteVehicle] = useState<{ id: string; label: string } | null>(null);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);
  const { data: vehicles = [], isLoading, isError, error } = useVehiclesQuery({ live: true });
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', 'list'],
    queryFn: listReservationsRequest,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: LIVE_COLLAB_REFETCH_MS,
    refetchOnWindowFocus: true,
  });

  const reservationDueByVehicleId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const r of reservations) {
      if (r.status !== 'ACTIVE') continue;
      map.set(r.vehicleId, isReservationDueToday(r.reservationDate));
    }
    return map;
  }, [reservations]);

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les vehicules.");
    }
  }, [isError, error]);

  const filtered = vehicles.filter(v => {
    const matchStatus = filter === 'all' || v.status === filter;
    const matchSearch = search === '' ||
      `${v.brand} ${v.model} ${v.plate}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleConfirmVehicleDelete = async () => {
    if (!pendingDeleteVehicle || isDeletingVehicle) return;
    setIsDeletingVehicle(true);
    try {
      await moveVehicleToTrashRequest(pendingDeleteVehicle.id);
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      await queryClient.invalidateQueries({ queryKey: ['trash', 'items', 'list'] });
      toast.success(`${pendingDeleteVehicle.label} deplace dans la corbeille.`);
      setPendingDeleteVehicle(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Echec de la suppression.');
    } finally {
      setIsDeletingVehicle(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Véhicules</h1>
          <p className="text-muted-foreground mt-1">{vehicles.length} vehicules enregistres</p>
        </div>
        <Link
          to="/vehicles/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Ajouter un véhicule
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par marque, modèle ou plaque..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Chargement des vehicules...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(v => {
            const canDelete = v.status === 'available' || v.status === 'sold';
            const reservationDueToday =
              v.status === 'reserved' && (reservationDueByVehicleId.get(v.id) === true);
            return (
              <VehicleCard
                key={v.id}
                vehicle={v}
                showActions
                reservationDueToday={reservationDueToday}
                onEdit={(vehicle) => {
                  navigate(`/vehicles/${vehicle.id}/edit`);
                }}
                onDelete={
                  canDelete
                    ? (vehicle) => {
                        setPendingDeleteVehicle({ id: vehicle.id, label: `${vehicle.brand} ${vehicle.model}` });
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Aucun véhicule trouvé.</p>
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingDeleteVehicle)}
        onOpenChange={(open) => !open && !isDeletingVehicle && setPendingDeleteVehicle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer à la corbeille</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous envoyer {pendingDeleteVehicle?.label ?? 'ce véhicule'} dans la corbeille ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingVehicle}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmVehicleDelete} disabled={isDeletingVehicle}>
              {isDeletingVehicle ? 'Suppression...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isDeletingVehicle && (
        <FullscreenLoader message="Suppression du véhicule..." />
      )}
    </div>
  );
}

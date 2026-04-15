import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { VehicleStatus, STATUS_LABELS } from '@/types/vehicle';
import VehicleCard from '@/components/VehicleCard';
import { listVehiclesRequest } from '@/lib/vehicle-api';

const statusFilters: (VehicleStatus | 'all')[] = ['all', 'available', 'sold', 'rented', 'repair', 'reserved'];

export default function VehicleList() {
  const [filter, setFilter] = useState<VehicleStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [vehicles, setVehicles] = useState<Awaited<ReturnType<typeof listVehiclesRequest>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        setLoading(true);
        const data = await listVehiclesRequest();
        setVehicles(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Impossible de charger les vehicules.");
      } finally {
        setLoading(false);
      }
    };

    void loadVehicles();
  }, []);

  const filtered = vehicles.filter(v => {
    const matchStatus = filter === 'all' || v.status === filter;
    const matchSearch = search === '' ||
      `${v.brand} ${v.model} ${v.plate}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

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
      {loading ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Chargement des vehicules...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(v => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Aucun véhicule trouvé.</p>
        </div>
      )}
    </div>
  );
}

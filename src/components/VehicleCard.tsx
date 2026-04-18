import { Link } from 'react-router-dom';
import { CalendarCheck, Car, Fuel, Gauge, MoreVertical } from 'lucide-react';
import { Vehicle } from '@/types/vehicle';
import StatusBadge from './StatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VehicleCardProps {
  vehicle: Vehicle;
  showActions?: boolean;
  /** Affiche un repère lorsque la date prévue de la réservation active est aujourd’hui (liste véhicules). */
  reservationDueToday?: boolean;
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicle: Vehicle) => void;
}

export default function VehicleCard({
  vehicle,
  showActions = false,
  reservationDueToday = false,
  onEdit,
  onDelete,
}: VehicleCardProps) {
  return (
    <div className="glass-card overflow-hidden group hover:border-primary/30 transition-all animate-fade-in">
      {/* Vehicle cover */}
      <div className="relative">
        <Link to={`/vehicles/${vehicle.id}`} className="block h-40 bg-secondary">
          {vehicle.photos.length > 0 ? (
            <img
              src={vehicle.photos[0]}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full bg-secondary flex items-center justify-center">
              <Car className="w-12 h-12 text-muted-foreground/40" />
            </div>
          )}
        </Link>

        {reservationDueToday && (
          <div
            className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md border border-violet-300/80 bg-violet-600/95 px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
            title="La date prévue de réservation est aujourd'hui"
          >
            <CalendarCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>Jour de réservation</span>
          </div>
        )}

        {showActions && (
          <div className="absolute top-2 right-2 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => event.preventDefault()}
                  className="w-8 h-8 rounded-md bg-background/85 border border-border flex items-center justify-center hover:bg-background transition-colors"
                  aria-label="Actions vehicule"
                >
                  <MoreVertical className="w-4 h-4 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {vehicle.status !== 'sold' && (
                  <DropdownMenuItem onClick={() => onEdit?.(vehicle)}>
                    Modifier
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(vehicle)}
                    className="text-destructive focus:text-destructive"
                  >
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Link to={`/vehicles/${vehicle.id}`} className="block p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {vehicle.brand} {vehicle.model}
            </h3>
            <p className="text-sm text-muted-foreground">{vehicle.year} · {vehicle.color}</p>
          </div>
          <StatusBadge status={vehicle.status} />
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5" />
            {vehicle.mileage.toLocaleString()} km
          </span>
          <span className="flex items-center gap-1">
            <Fuel className="w-3.5 h-3.5" />
            {vehicle.fuel}
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Vente</p>
            <p className="text-sm font-semibold text-foreground">{vehicle.salePrice.toLocaleString()} CFA</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Location/jour</p>
            <p className="text-sm font-semibold text-foreground">{vehicle.rentalPrice} CFA</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Ajoute par: {vehicle.createdByName || "Utilisateur"}</p>
      </Link>
    </div>
  );
}

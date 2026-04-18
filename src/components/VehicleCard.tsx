import type { PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarX, Car, Fuel, Gauge, MoreVertical } from 'lucide-react';
import { subscriptionExpiredToast } from '@/context/SubscriptionWorkspaceContext';
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
  /** Période réservée dépassée alors que la réservation est encore active (liste véhicules). */
  reservationPeriodEnded?: boolean;
  /** Abonnement expiré : pas de navigation vers la fiche véhicule. */
  detailLinkDisabled?: boolean;
  /** Abonnement expiré : masque le menu actions. */
  actionsLocked?: boolean;
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicle: Vehicle) => void;
}

export default function VehicleCard({
  vehicle,
  showActions = false,
  reservationDueToday = false,
  reservationPeriodEnded = false,
  detailLinkDisabled = false,
  actionsLocked = false,
  onEdit,
  onDelete,
}: VehicleCardProps) {
  const showMenu = showActions && !actionsLocked;

  const handleLockedDetailPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    subscriptionExpiredToast();
  };

  const CoverInner = (
    <>
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
    </>
  );

  return (
    <div
      className={`glass-card overflow-hidden group transition-all animate-fade-in ${
        detailLinkDisabled ? "opacity-95" : "hover:border-primary/30"
      }`}
    >
      {/* Vehicle cover */}
      <div className="relative">
        {detailLinkDisabled ? (
          <div
            className="block h-40 bg-secondary cursor-not-allowed"
            onPointerDown={handleLockedDetailPointerDown}
            role="presentation"
          >
            {CoverInner}
          </div>
        ) : (
          <Link to={`/vehicles/${vehicle.id}`} className="block h-40 bg-secondary">
            {CoverInner}
          </Link>
        )}
        {reservationDueToday && (
          <div
            className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md border border-violet-300/80 bg-violet-600/95 px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
            title="Aujourd'hui fait partie de la période réservée pour ce véhicule"
          >
            <CalendarCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>Jour de réservation</span>
          </div>
        )}

        {reservationPeriodEnded && (
          <div
            className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md border border-amber-400/90 bg-amber-600/95 px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
            title="La période prévue pour cette réservation est terminée — pensez à finaliser ou suivre le véhicule"
          >
            <CalendarX className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>Réservation terminée</span>
          </div>
        )}

        {showMenu && (
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

      {detailLinkDisabled ? (
        <div
          className="block p-4 space-y-3 cursor-not-allowed"
          onPointerDown={handleLockedDetailPointerDown}
          role="presentation"
        >
          <Body />
        </div>
      ) : (
        <Link to={`/vehicles/${vehicle.id}`} className="block p-4 space-y-3">
          <Body />
        </Link>
      )}
    </div>
  );

  function Body() {
    return (
      <>
        <div className="flex items-start justify-between">
          <div>
            <h3
              className={`font-semibold text-foreground transition-colors ${
                detailLinkDisabled ? "" : "group-hover:text-primary"
              }`}
            >
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
      </>
    );
  }
}

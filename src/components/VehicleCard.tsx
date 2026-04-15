import { Link } from 'react-router-dom';
import { Car, Fuel, Gauge } from 'lucide-react';
import { Vehicle } from '@/types/vehicle';
import StatusBadge from './StatusBadge';

interface VehicleCardProps {
  vehicle: Vehicle;
}

export default function VehicleCard({ vehicle }: VehicleCardProps) {
  return (
    <Link to={`/vehicles/${vehicle.id}`} className="glass-card overflow-hidden group hover:border-primary/30 transition-all animate-fade-in">
      {/* Photo placeholder */}
      <div className="h-40 bg-secondary flex items-center justify-center">
        <Car className="w-12 h-12 text-muted-foreground/40" />
      </div>

      <div className="p-4 space-y-3">
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
            <p className="text-sm font-semibold text-foreground">{vehicle.salePrice.toLocaleString()} €</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Location/jour</p>
            <p className="text-sm font-semibold text-foreground">{vehicle.rentalPrice} €</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

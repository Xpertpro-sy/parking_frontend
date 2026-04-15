import { Car, CheckCircle, Wrench, Key, DollarSign } from 'lucide-react';
import { mockVehicles } from '@/data/mockVehicles';
import StatCard from '@/components/StatCard';
import VehicleCard from '@/components/VehicleCard';
import heroImage from '@/assets/hero-parking.jpg';

export default function Dashboard() {
  const total = mockVehicles.length;
  const available = mockVehicles.filter(v => v.status === 'available').length;
  const sold = mockVehicles.filter(v => v.status === 'sold').length;
  const rented = mockVehicles.filter(v => v.status === 'rented').length;
  const inRepair = mockVehicles.filter(v => v.status === 'repair').length;

  const recentVehicles = mockVehicles.slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="relative rounded-xl overflow-hidden h-48">
        <img src={heroImage} alt="Parking" className="w-full h-full object-cover" width={1920} height={640} />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-background/30 flex items-center px-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1">Vue d'ensemble de votre parking</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total véhicules" value={total} icon={Car} />
        <StatCard label="Disponibles" value={available} icon={CheckCircle} accent="bg-success/10" />
        <StatCard label="Vendus" value={sold} icon={DollarSign} accent="bg-destructive/10" />
        <StatCard label="En location" value={rented} icon={Key} accent="bg-info/10" />
        <StatCard label="En réparation" value={inRepair} icon={Wrench} accent="bg-warning/10" />
      </div>

      {/* Recent */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Véhicules récents</h2>
          <a href="/vehicles" className="text-sm text-primary hover:underline">Voir tout →</a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentVehicles.map(v => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      </div>
    </div>
  );
}

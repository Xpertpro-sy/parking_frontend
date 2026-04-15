export type VehicleStatus = 'available' | 'sold' | 'rented' | 'repair' | 'reserved';

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  fuel: string;
  mileage: number;
  salePrice: number;
  rentalPrice: number;
  description: string;
  condition: string;
  status: VehicleStatus;
  photos: string[];
  createdAt: string;
}

export interface Sale {
  id: string;
  vehicleId: string;
  buyerName: string;
  buyerPhone: string;
  amount: number;
  date: string;
}

export interface Rental {
  id: string;
  vehicleId: string;
  tenantName: string;
  tenantPhone: string;
  startDate: string;
  endDate: string;
  amount: number;
}

export interface Repair {
  id: string;
  vehicleId: string;
  reason: string;
  cost: number;
  startDate: string;
  endDate?: string;
}

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  available: 'Disponible',
  sold: 'Vendu',
  rented: 'En location',
  repair: 'En réparation',
  reserved: 'Réservé',
};

export const STATUS_STYLES: Record<VehicleStatus, string> = {
  available: 'status-available',
  sold: 'status-sold',
  rented: 'status-rented',
  repair: 'status-repair',
  reserved: 'status-reserved',
};

import { getAccessToken } from "@/context/AuthContext";
import { Vehicle, VehicleStatus } from "@/types/vehicle";

export type CreateVehiclePayload = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  fuel: string;
  mileage: number;
  salePrice: number;
  rentalPrice: number;
  description?: string;
  condition: string;
  photos: string[];
};

export type UpdateVehiclePayload = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  fuel: string;
  mileage: number;
  salePrice: number;
  rentalPrice: number;
  description?: string;
  condition: string;
  photos: string[];
  status?: string;
};

export type VehicleApiResponse = {
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
  description: string | null;
  condition: string;
  status: string;
  photos: string[];
  createdAt: string;
  ownerUserId: number;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8080";

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    if (data.error) return data.error;
    if (data.message) return data.message;
  } catch {
    // Ignore parsing failure.
  }
  return "Erreur serveur. Veuillez reessayer.";
}

function mapStatus(status: string): VehicleStatus {
  const normalized = status.trim().toLowerCase();
  const knownStatuses: VehicleStatus[] = ["available", "sold", "rented", "repair", "reserved"];
  if (knownStatuses.includes(normalized as VehicleStatus)) {
    return normalized as VehicleStatus;
  }
  return "available";
}

export function mapVehicleApiResponseToVehicle(apiVehicle: VehicleApiResponse): Vehicle {
  return {
    id: apiVehicle.id,
    brand: apiVehicle.brand,
    model: apiVehicle.model,
    year: apiVehicle.year,
    color: apiVehicle.color,
    plate: apiVehicle.plate,
    fuel: apiVehicle.fuel,
    mileage: apiVehicle.mileage,
    salePrice: apiVehicle.salePrice,
    rentalPrice: apiVehicle.rentalPrice,
    description: apiVehicle.description ?? "",
    condition: apiVehicle.condition,
    status: mapStatus(apiVehicle.status),
    photos: apiVehicle.photos ?? [],
    createdAt: apiVehicle.createdAt,
  };
}

async function getWithAuth<TResponse>(endpoint: string): Promise<TResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as TResponse;
}

export async function createVehicleRequest(payload: CreateVehiclePayload): Promise<VehicleApiResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/vehicles`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as VehicleApiResponse;
}

export async function updateVehicleRequest(vehicleId: string, payload: UpdateVehiclePayload): Promise<VehicleApiResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/vehicles/${vehicleId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as VehicleApiResponse;
}

export async function listVehiclesRequest(): Promise<Vehicle[]> {
  const response = await getWithAuth<VehicleApiResponse[]>("/api/auth/vehicles");
  return response.map(mapVehicleApiResponseToVehicle);
}

export async function getVehicleByIdRequest(vehicleId: string): Promise<Vehicle | null> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/vehicles/${vehicleId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const apiVehicle = (await response.json()) as VehicleApiResponse;
  return mapVehicleApiResponseToVehicle(apiVehicle);
}

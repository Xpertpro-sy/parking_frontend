import { getAccessToken } from "@/context/AuthContext";

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

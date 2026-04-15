import { getAccessToken } from "@/context/AuthContext";

export type CreateReservationPayload = {
  customerName: string;
  customerPhone: string;
  notes?: string;
  reservationDate: string;
  amountPaid: number;
};

export type CreateRepairPayload = {
  reason: string;
  cost: number;
  startDate: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8080";

export type ReservationApiResponse = {
  id: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  ownerUserId: number;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  reservationDate: string;
  amountPaid: number;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  cancelledAt: string | null;
  createdAt: string;
};

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    if (data.error) return data.error;
    if (data.message) return data.message;
  } catch {
    // Ignore parsing failure
  }
  if (response.status === 401) {
    return "Session expiree. Veuillez vous reconnecter.";
  }
  return "Erreur serveur. Veuillez reessayer.";
}

function getTokenOrThrow() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }
  return token;
}

async function postWithAuth(endpoint: string, payload: unknown) {
  const token = getTokenOrThrow();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
}

export async function createReservationRequest(vehicleId: string, payload: CreateReservationPayload): Promise<void> {
  await postWithAuth(`/api/auth/vehicles/${vehicleId}/reservations`, payload);
}

export async function createRepairRequest(vehicleId: string, payload: CreateRepairPayload): Promise<void> {
  await postWithAuth(`/api/auth/vehicles/${vehicleId}/repairs`, payload);
}

export async function completeRepairRequest(vehicleId: string): Promise<void> {
  const token = getTokenOrThrow();
  const response = await fetch(`${API_BASE_URL}/api/auth/vehicles/${vehicleId}/repairs/complete`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function listReservationsRequest(): Promise<ReservationApiResponse[]> {
  const token = getTokenOrThrow();
  const response = await fetch(`${API_BASE_URL}/api/auth/reservations`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ReservationApiResponse[];
}

export async function cancelReservationRequest(vehicleId: string): Promise<void> {
  const token = getTokenOrThrow();
  const response = await fetch(`${API_BASE_URL}/api/auth/vehicles/${vehicleId}/reservations/cancel`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

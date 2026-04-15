import { getAccessToken } from "@/context/AuthContext";

export type CreateRentalPayload = {
  vehicleId: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl?: string;
  tenantAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  startDate: string;
  endDate: string;
  amount: number;
  depositAmount?: number;
};

export type RentalApiResponse = {
  id: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  ownerUserId: number;
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl: string | null;
  tenantAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyPrice: number;
  amount: number;
  depositAmount: number | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
  receipt: RentalReceiptApiResponse | null;
};

export type RentalReceiptApiResponse = {
  id: string;
  receiptNumber: string;
  rentalId: string;
  vehicleId: string;
  ownerUserId: number;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdCardNumber: string;
  tenantIdCardPhotoUrl: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  dailyPrice: number;
  rentalAmount: number;
  depositAmount: number | null;
  issuedAt: string;
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

function getTokenOrThrow() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }
  return token;
}

export async function createRentalRequest(payload: CreateRentalPayload): Promise<RentalApiResponse> {
  const token = getTokenOrThrow();

  const response = await fetch(`${API_BASE_URL}/api/auth/rentals`, {
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

  return (await response.json()) as RentalApiResponse;
}

export async function listRentalsRequest(): Promise<RentalApiResponse[]> {
  const token = getTokenOrThrow();

  const response = await fetch(`${API_BASE_URL}/api/auth/rentals`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as RentalApiResponse[];
}

export async function completeRentalRequest(rentalId: string): Promise<RentalApiResponse> {
  const token = getTokenOrThrow();

  const response = await fetch(`${API_BASE_URL}/api/auth/rentals/${rentalId}/complete`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as RentalApiResponse;
}

export async function getReceiptByRentalIdRequest(rentalId: string): Promise<RentalReceiptApiResponse | null> {
  const token = getTokenOrThrow();

  const response = await fetch(`${API_BASE_URL}/api/auth/rentals/${rentalId}/receipt`, {
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

  return (await response.json()) as RentalReceiptApiResponse;
}

export async function listRentalReceiptsRequest(): Promise<RentalReceiptApiResponse[]> {
  const rentals = await listRentalsRequest();
  const receipts = await Promise.all(rentals.map((rental) => getReceiptByRentalIdRequest(rental.id)));
  return receipts.filter((receipt): receipt is RentalReceiptApiResponse => receipt !== null);
}

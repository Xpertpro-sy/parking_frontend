import { getAccessToken } from "@/context/AuthContext";

export type CreateSalePayload = {
  vehicleId: string;
  buyerName: string;
  buyerPhone: string;
  amount: number;
  date?: string;
};

export type SaleApiResponse = {
  id: string;
  vehicleId: string;
  sellerUserId: number;
  buyerName: string;
  buyerPhone: string;
  amount: number;
  date: string;
  receipt: {
    id: string;
    receiptNumber: string;
  } | null;
};

export type ReceiptApiResponse = {
  id: string;
  receiptNumber: string;
  saleId: string;
  vehicleId: string;
  sellerUserId: number;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  buyerName: string;
  buyerPhone: string;
  amount: number;
  saleDate: string;
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

async function getTokenOrThrow() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }
  return token;
}

async function getWithAuth<TResponse>(endpoint: string): Promise<TResponse> {
  const token = await getTokenOrThrow();

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

export async function createSaleRequest(payload: CreateSalePayload): Promise<SaleApiResponse> {
  const token = await getTokenOrThrow();

  const response = await fetch(`${API_BASE_URL}/api/auth/sales`, {
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

  return (await response.json()) as SaleApiResponse;
}

export async function listSalesRequest(): Promise<SaleApiResponse[]> {
  return getWithAuth<SaleApiResponse[]>("/api/auth/sales");
}

export async function getReceiptBySaleIdRequest(saleId: string): Promise<ReceiptApiResponse | null> {
  const token = await getTokenOrThrow();
  const response = await fetch(`${API_BASE_URL}/api/auth/sales/${saleId}/receipt`, {
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

  return (await response.json()) as ReceiptApiResponse;
}

export async function listReceiptsRequest(): Promise<ReceiptApiResponse[]> {
  const sales = await listSalesRequest();
  const receipts = await Promise.all(sales.map((sale) => getReceiptBySaleIdRequest(sale.id)));
  return receipts.filter((receipt): receipt is ReceiptApiResponse => receipt !== null);
}

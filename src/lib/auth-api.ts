export type RegisterPayload = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthApiResponse = {
  message: string;
  accessToken: string;
  userId: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8080";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    if (data.error) return data.error;
    if (data.message) return data.message;
  } catch {
    // Ignore parsing errors and fallback to generic message.
  }

  if (response.status === 401) {
    return "Email ou mot de passe incorrect.";
  }

  return "Une erreur est survenue. Veuillez reessayer.";
}

async function postAuth<TPayload>(endpoint: string, payload: TPayload): Promise<AuthApiResponse> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as AuthApiResponse;
}

export async function registerRequest(payload: RegisterPayload) {
  return postAuth("/api/auth/register", payload);
}

export async function loginRequest(payload: LoginPayload) {
  return postAuth("/api/auth/login", payload);
}

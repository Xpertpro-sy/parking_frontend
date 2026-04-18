import { getAccessToken } from "@/lib/auth-session";
import {
  changePasswordFirebase,
  fetchUserProfileFirebase,
  parseProfileError,
  updateUserProfileFirebase,
  type UserProfile,
} from "@/lib/profile-firebase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8080";
const AUTH_PROVIDER = ((import.meta.env.VITE_AUTH_PROVIDER as string | undefined)?.trim().toLowerCase() || "spring");

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    if (data.error) return data.error;
    if (data.message) return data.message;
  } catch {
    /* ignore */
  }
  if (response.status === 401) return "Non autorisé. Reconnectez-vous.";
  return `Erreur serveur (${response.status}).`;
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  if (!token) throw new Error("Session expirée. Veuillez vous reconnecter.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Profil affiché sur la page compte (Firebase ou API Spring si implémentée). */
export async function fetchUserProfile(): Promise<UserProfile> {
  if (AUTH_PROVIDER === "firebase") {
    return fetchUserProfileFirebase();
  }

  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: authHeaders(),
  });
  if (res.status === 404) {
    throw new Error(
      "Profil API indisponible : le serveur Spring doit exposer GET /api/users/me ou utilisez VITE_AUTH_PROVIDER=firebase.",
    );
  }
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = (await res.json()) as {
    prenom?: string;
    nom?: string;
    email?: string;
    telephone?: string;
    role?: string;
  };
  return {
    firstName: (data.prenom ?? "").trim() || "Utilisateur",
    lastName: (data.nom ?? "").trim(),
    email: (data.email ?? "").trim(),
    phone: (data.telephone ?? "").trim(),
    roleLabel: (data.role ?? "").toUpperCase() === "GESTIONNAIRE" ? "Gestionnaire" : "Administrateur",
  };
}

export async function updateUserProfile(payload: {
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<void> {
  if (AUTH_PROVIDER === "firebase") {
    await updateUserProfileFirebase(payload);
    return;
  }

  const res = await fetch(`${API_BASE_URL}/api/users/me`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({
      prenom: payload.firstName.trim(),
      nom: payload.lastName.trim(),
      telephone: payload.phone.trim() || null,
    }),
  });
  if (res.status === 404) {
    throw new Error("Mise à jour impossible : PATCH /api/users/me non disponible sur le serveur.");
  }
  if (!res.ok) throw new Error(await parseApiError(res));
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
  if (AUTH_PROVIDER === "firebase") {
    try {
      await changePasswordFirebase(payload);
    } catch (e) {
      throw new Error(parseProfileError(e));
    }
    return;
  }

  const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    }),
  });
  if (res.status === 404) {
    throw new Error(
      "Changement de mot de passe indisponible : POST /api/auth/change-password non implémenté sur le serveur.",
    );
  }
  if (!res.ok) throw new Error(await parseApiError(res));
}

export type { UserProfile };

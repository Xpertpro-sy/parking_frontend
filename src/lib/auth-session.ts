/** Clés session + lecture du jeton sans importer le contexte React (évite les exports mélangés dans AuthContext, compatibles avec le Fast Refresh Vite). */

export const STORAGE_AUTH_TOKEN_KEY = "gestion-parking-auth-token";
export const STORAGE_CURRENT_USER_KEY = "gestion-parking-current-user";

export function getAccessToken() {
  const localToken = localStorage.getItem(STORAGE_AUTH_TOKEN_KEY);
  if (localToken) return localToken;
  const legacySessionToken = sessionStorage.getItem(STORAGE_AUTH_TOKEN_KEY);
  if (legacySessionToken) {
    localStorage.setItem(STORAGE_AUTH_TOKEN_KEY, legacySessionToken);
    sessionStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
  }
  return legacySessionToken;
}

const AUTH_PROVIDER = ((import.meta.env.VITE_AUTH_PROVIDER as string | undefined)?.trim().toLowerCase() || "spring");

/**
 * Retourne un token d'acces utilisable.
 * En mode Firebase, on tente un refresh silencieux pour eviter les 401 apres expiration.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const storedToken = getAccessToken();
  if (AUTH_PROVIDER !== "firebase") {
    return storedToken;
  }

  try {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      return storedToken;
    }
    const refreshedToken = await user.getIdToken();
    localStorage.setItem(STORAGE_AUTH_TOKEN_KEY, refreshedToken);
    sessionStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
    return refreshedToken;
  } catch {
    return storedToken;
  }
}

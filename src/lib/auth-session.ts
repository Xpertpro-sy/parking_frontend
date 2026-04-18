/** Clés session + lecture du jeton sans importer le contexte React (évite les exports mélangés dans AuthContext, compatibles avec le Fast Refresh Vite). */

export const STORAGE_AUTH_TOKEN_KEY = "gestion-parking-auth-token";
export const STORAGE_CURRENT_USER_KEY = "gestion-parking-current-user";

export function getAccessToken() {
  return sessionStorage.getItem(STORAGE_AUTH_TOKEN_KEY);
}

/** Identifiant du compte super administrateur (back-office). Le mot de passe est défini uniquement via le script `npm run seed:super-admin`. */

export const SUPER_ADMIN_DEFAULT_EMAIL = "sytechsy@gmail.com";

export function isSuperAdminRole(role: string | undefined): boolean {
  return role?.toUpperCase() === "SUPER_ADMIN";
}

/**
 * Liens encore autorisés sans abonnement actif : navigation entre modules en lecture,
 * fiches liste (sans id), paramètres et profil.
 */
export function isTenantNavAllowedWhenSubscriptionExpired(href: string): boolean {
  try {
    const trimmed = href.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:")
    ) {
      return true;
    }

    const path = href.split("?")[0].split("#")[0] || "";

    if (path === "/" || path === "/vehicles") return true;
    if (path.startsWith("/settings") || path.startsWith("/profil")) return true;

    const listRoutes = [
      "/receipts",
      "/comptability",
      "/voitures-louees",
      "/voitures-reservees",
      "/history",
      "/comptes",
      "/corbeille",
    ];
    return listRoutes.includes(path);
  } catch {
    return false;
  }
}

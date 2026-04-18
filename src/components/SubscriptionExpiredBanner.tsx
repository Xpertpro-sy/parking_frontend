import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useSubscriptionWorkspace } from "@/context/SubscriptionWorkspaceContext";

/** Hauteur approximative pour le padding du contenu sous la bannière (fixed). */
export const SUBSCRIPTION_EXPIRED_BANNER_OFFSET_CLASS = "pt-[3.25rem]";

export default function SubscriptionExpiredBanner() {
  const { showExpiredBanner } = useSubscriptionWorkspace();

  if (!showExpiredBanner) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] border-b border-amber-900/25 bg-amber-700 text-white shadow-sm md:left-64"
      role="region"
      aria-label="Abonnement expiré"
    >
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-center sm:gap-4 sm:px-4">
        <p className="flex items-center justify-center gap-2 text-center text-sm font-medium text-white">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-100" aria-hidden />
          <span>
            Votre abonnement est terminé. Vous pouvez consulter vos données, mais les actions (ajouts, modifications,
            suppressions) sont désactivées jusqu’au renouvellement.
          </span>
        </p>
        <Link
          to="/settings#abonnement"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-50"
        >
          Gérer l’abonnement
        </Link>
      </div>
    </div>
  );
}

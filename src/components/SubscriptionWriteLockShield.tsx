import type { ReactNode } from "react";
import { subscriptionExpiredToast, useSubscriptionWorkspaceState } from "@/context/SubscriptionWorkspaceContext";
import { shouldBlockSubscriptionInteraction } from "@/lib/subscription-write-lock";

type Props = {
  children: ReactNode;
  /** Si true, bloque aussi la saisie dans champs (formulaires comptables, etc.). */
  blockFormFields?: boolean;
};

/**
 * Intercepte clics / clavier quand l’abonnement est expiré, tout en laissant défiler la page.
 * Les liens vers les vues « liste » autorisées passent (voir `subscription-expired-nav.ts`).
 */
export default function SubscriptionWriteLockShield({ children, blockFormFields = false }: Props) {
  const subscription = useSubscriptionWorkspaceState();
  const isWriteLocked = subscription?.isWriteLocked ?? false;

  if (!isWriteLocked) return <>{children}</>;

  const stopIfLocked = (e: React.SyntheticEvent) => {
    if (!shouldBlockSubscriptionInteraction(e.target, blockFormFields)) return;
    e.preventDefault();
    e.stopPropagation();
    subscriptionExpiredToast();
  };

  return (
    <div
      className="relative min-h-0"
      onPointerDownCapture={stopIfLocked}
      onClickCapture={stopIfLocked}
      onKeyDownCapture={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        stopIfLocked(e);
      }}
    >
      {children}
    </div>
  );
}

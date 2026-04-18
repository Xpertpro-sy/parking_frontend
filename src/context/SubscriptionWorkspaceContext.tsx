import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCurrentUserAccessProfile } from "@/lib/access-control";
import {
  getTenantSubscriptionStateRequest,
  tenantSubscriptionStateQueryKey,
} from "@/lib/subscription-api";

const TOAST_MESSAGE =
  "Votre abonnement a expiré. Renouvelez depuis Paramètres → Abonnement pour utiliser à nouveau ces actions.";

const TOAST_DEBOUNCE_MS = 550;
let lastSubscriptionExpiredToastAt = 0;

export function subscriptionExpiredToast() {
  const now = Date.now();
  if (now - lastSubscriptionExpiredToastAt < TOAST_DEBOUNCE_MS) return;
  lastSubscriptionExpiredToastAt = now;
  toast.error(TOAST_MESSAGE);
}

type Ctx = {
  /** Profil chargé et requête abonnement terminée. */
  subscriptionResolved: boolean;
  isSubscriptionActive: boolean;
  /** Bloque actions métier (lecture / navigation listes autorisées). */
  isWriteLocked: boolean;
  showExpiredBanner: boolean;
};

const SubscriptionWorkspaceContext = createContext<Ctx | null>(null);

export function SubscriptionWorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["access-profile"],
    queryFn: getCurrentUserAccessProfile,
  });

  const tenantWorkspace =
    profile?.role === "ADMIN" || profile?.role === "GESTIONNAIRE";
  const ownerUid = profile?.uid ?? "";

  const subscriptionQueryEnabled = Boolean(tenantWorkspace && ownerUid);

  const { data: subState, isLoading: subLoading } = useQuery({
    queryKey: tenantSubscriptionStateQueryKey(ownerUid),
    queryFn: () => getTenantSubscriptionStateRequest(ownerUid),
    enabled: subscriptionQueryEnabled,
  });

  const value = useMemo<Ctx>(() => {
    const subscriptionResolved =
      Boolean(tenantWorkspace) && !profileLoading && subscriptionQueryEnabled && !subLoading;

    const isSubscriptionActive = Boolean(subState?.isActive);

    const showExpiredBanner = subscriptionResolved && !isSubscriptionActive;

    const isWriteLocked = showExpiredBanner;

    return {
      subscriptionResolved,
      isSubscriptionActive,
      isWriteLocked,
      showExpiredBanner,
    };
  }, [
    tenantWorkspace,
    profileLoading,
    subscriptionQueryEnabled,
    subLoading,
    subState?.isActive,
  ]);

  return (
    <SubscriptionWorkspaceContext.Provider value={value}>{children}</SubscriptionWorkspaceContext.Provider>
  );
}

export function useSubscriptionWorkspace(): Ctx {
  const ctx = useContext(SubscriptionWorkspaceContext);
  if (!ctx) {
    throw new Error("useSubscriptionWorkspace doit être utilisé sous SubscriptionWorkspaceProvider.");
  }
  return ctx;
}

/** Même état que le provider tenant, ou null (ex. super-admin hors AppLayout). */
export function useSubscriptionWorkspaceState(): Ctx | null {
  return useContext(SubscriptionWorkspaceContext);
}

/** Pour pages sous provider : bloquer une action avec toast. */
export function useSubscriptionActionGuard() {
  const { isWriteLocked } = useSubscriptionWorkspace();

  const guard = useCallback(
    (fn: () => void) => {
      if (isWriteLocked) {
        subscriptionExpiredToast();
        return;
      }
      fn();
    },
    [isWriteLocked],
  );

  return { isWriteLocked, guard };
}

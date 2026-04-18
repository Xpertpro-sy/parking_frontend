import { isTenantNavAllowedWhenSubscriptionExpired } from "@/lib/subscription-expired-nav";

/**
 * Indique si un pointeur / activation clavier doit être bloqué (abonnement expiré).
 * Les sous-arbres marqués `data-subscription-lock-bypass` restent utilisables (filtres, pagination).
 */
export function shouldBlockSubscriptionInteraction(target: EventTarget | null, blockFormFields: boolean): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-subscription-lock-bypass]")) return false;

  const link = target.closest("a[href]");
  if (link) {
    const href = link.getAttribute("href") ?? "";
    return !isTenantNavAllowedWhenSubscriptionExpired(href);
  }

  if (target.closest("button")) return true;
  if (target.closest("summary")) return true;

  if (
    target.closest(
      "[role='button'],[role='menuitem'],[role='switch'],[role='combobox'],[role='listbox'],[role='option'],[role='menuitemcheckbox'],[role='menuitemradio'],[role='tab']",
    )
  ) {
    return true;
  }

  const input = target.closest("input");
  if (input) {
    const type = input.type;
    if (type === "hidden") return false;
    if (["submit", "button", "image", "reset", "file", "checkbox", "radio"].includes(type)) return true;
    if (blockFormFields) return true;
    return false;
  }

  if (blockFormFields && target.closest("select, textarea")) return true;

  if (blockFormFields) {
    const label = target.closest("label");
    if (label instanceof HTMLLabelElement) {
      if (label.htmlFor) return true;
      if (label.querySelector("input:not([type='hidden']), select, textarea")) return true;
    }
  }

  return false;
}

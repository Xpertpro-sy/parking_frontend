export type BrandingMode = "text" | "image";

export type BrandingConfig = {
  mode: BrandingMode;
  text: string;
  imageDataUrl: string | null;
  imageScale: number;
};

const DEFAULT_BRANDING: BrandingConfig = {
  mode: "text",
  text: "AutoParc",
  imageDataUrl: null,
  imageScale: 100,
};

const BRANDING_EVENT = "gestion-parking-branding-updated";

function getBrandingKey(userEmail?: string | null) {
  if (!userEmail) return null;
  return `gestion-parking-branding:${userEmail.trim().toLowerCase()}`;
}

export function readBranding(userEmail?: string | null): BrandingConfig {
  const key = getBrandingKey(userEmail);
  if (!key) return DEFAULT_BRANDING;

  const raw = localStorage.getItem(key);
  if (!raw) return DEFAULT_BRANDING;

  try {
    const parsed = JSON.parse(raw) as Partial<BrandingConfig>;
    return {
      mode: parsed.mode === "image" ? "image" : "text",
      text: typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim() : DEFAULT_BRANDING.text,
      imageDataUrl: typeof parsed.imageDataUrl === "string" ? parsed.imageDataUrl : null,
      imageScale:
        typeof parsed.imageScale === "number" && Number.isFinite(parsed.imageScale)
          ? Math.min(120, Math.max(20, parsed.imageScale))
          : DEFAULT_BRANDING.imageScale,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBranding(userEmail: string, config: BrandingConfig) {
  const key = getBrandingKey(userEmail);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: { userEmail } }));
}

export function clearBranding(userEmail: string) {
  const key = getBrandingKey(userEmail);
  if (!key) return;
  localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: { userEmail } }));
}

export function getBrandingEventName() {
  return BRANDING_EVENT;
}


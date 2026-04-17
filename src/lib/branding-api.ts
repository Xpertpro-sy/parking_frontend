import { getAccessToken } from "@/context/AuthContext";
import { getFirebaseDb, waitForFirebaseUser } from "@/lib/firebase";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export type BrandingMode = "text" | "image";

export type BrandingConfig = {
  mode: BrandingMode;
  text: string;
  imageDataUrl: string | null;
  imageScale: number;
};

type BrandingFirestoreDoc = {
  ownerUid: string;
  ownerEmail: string | null;
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

export const brandingSettingsQueryKey = ["branding", "settings"] as const;

async function getAuthIdentity() {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }
  const user = await waitForFirebaseUser();
  if (!user?.uid) {
    throw new Error("Session Firebase invalide. Veuillez vous reconnecter.");
  }
  return { uid: user.uid, email: user.email ?? null };
}

function normalizeImageScale(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_BRANDING.imageScale;
  return Math.min(120, Math.max(20, value));
}

export async function getBrandingSettingsRequest(): Promise<BrandingConfig> {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  const ref = doc(db, "brandingSettings", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return DEFAULT_BRANDING;
  const data = snap.data() as Partial<BrandingFirestoreDoc>;
  return {
    mode: data.mode === "image" ? "image" : "text",
    text: typeof data.text === "string" && data.text.trim() ? data.text.trim() : DEFAULT_BRANDING.text,
    imageDataUrl: typeof data.imageDataUrl === "string" ? data.imageDataUrl : null,
    imageScale: normalizeImageScale(Number(data.imageScale)),
  };
}

export async function saveBrandingTextRequest(params: { text: string }) {
  const db = getFirebaseDb();
  const { uid, email } = await getAuthIdentity();
  const ref = doc(db, "brandingSettings", uid);
  const text = params.text.trim() || DEFAULT_BRANDING.text;
  await setDoc(
    ref,
    {
      ownerUid: uid,
      ownerEmail: email,
      mode: "text",
      text,
      imageDataUrl: null,
      imageScale: DEFAULT_BRANDING.imageScale,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveBrandingImageRequest(params: { imageDataUrl: string; imageScale: number; fallbackText?: string }) {
  const db = getFirebaseDb();
  const { uid, email } = await getAuthIdentity();
  const ref = doc(db, "brandingSettings", uid);
  await setDoc(
    ref,
    {
      ownerUid: uid,
      ownerEmail: email,
      mode: "image",
      text: params.fallbackText?.trim() || DEFAULT_BRANDING.text,
      imageDataUrl: params.imageDataUrl,
      imageScale: normalizeImageScale(params.imageScale),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function resetBrandingSettingsRequest() {
  const db = getFirebaseDb();
  const { uid } = await getAuthIdentity();
  await deleteDoc(doc(db, "brandingSettings", uid));
}


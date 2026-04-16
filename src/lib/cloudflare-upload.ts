import { getAccessToken } from "@/context/AuthContext";
const CLOUDFLARE_PRESIGN_URL = (import.meta.env.VITE_CLOUDFLARE_PRESIGN_URL as string | undefined)?.trim();

type UploadResponse = {
  objectKey: string;
  publicUrl: string;
};

function resolveUploadUrl(): string {
  if (CLOUDFLARE_PRESIGN_URL) return CLOUDFLARE_PRESIGN_URL;
  throw new Error(
    "Aucun endpoint Cloudflare configure. Ajoutez VITE_CLOUDFLARE_PRESIGN_URL dans .env."
  );
}

async function requestUpload(token: string, file: File): Promise<Response> {
  const uploadUrl = resolveUploadUrl();
  const formData = new FormData();
  formData.append("file", file);

  try {
    return await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "erreur reseau";
    throw new Error(`Impossible de joindre le service upload Cloudflare (${uploadUrl}). ${details}`);
  }
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    if (data.error) return data.error;
    if (data.message) return data.message;
  } catch {
    // Ignore parsing errors.
  }
  if (response.status === 401) {
    return "Session expiree. Veuillez vous reconnecter.";
  }
  return "Echec de l'upload de l'image.";
}

export async function uploadImageToR2(file: File): Promise<string> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Session expiree. Veuillez vous reconnecter.");
  }
  const uploadResponse = await requestUpload(token, file);

  if (!uploadResponse.ok) {
    throw new Error(await parseApiError(uploadResponse));
  }

  const data = (await uploadResponse.json()) as UploadResponse;
  return data.publicUrl;
}

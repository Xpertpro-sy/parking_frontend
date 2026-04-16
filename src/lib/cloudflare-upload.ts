import { getAccessToken } from "@/context/AuthContext";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const PRESIGN_ENDPOINT_URL = (import.meta.env.VITE_UPLOAD_PRESIGN_URL as string | undefined)?.trim();

type PresignUploadResponse = {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
};

function resolvePresignUrl(): string {
  if (PRESIGN_ENDPOINT_URL) return PRESIGN_ENDPOINT_URL;
  if (API_BASE_URL) return `${API_BASE_URL}/api/auth/uploads/presign`;
  throw new Error(
    "Aucun endpoint de presign configure. Ajoutez VITE_UPLOAD_PRESIGN_URL (ou VITE_API_BASE_URL) dans .env."
  );
}

async function requestPresign(token: string, fileName: string, contentType: string): Promise<Response> {
  const presignUrl = resolvePresignUrl();
  try {
    return await fetch(presignUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName,
        contentType,
      }),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "erreur reseau";
    throw new Error(`Impossible de joindre le service de presign (${presignUrl}). ${details}`);
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

  const contentType = file.type?.trim() || "application/octet-stream";
  const presignResponse = await requestPresign(token, file.name, contentType);

  if (!presignResponse.ok) {
    throw new Error(await parseApiError(presignResponse));
  }

  const { uploadUrl, publicUrl } = (await presignResponse.json()) as PresignUploadResponse;
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Upload R2 echoue. Veuillez reessayer.");
  }

  return publicUrl;
}

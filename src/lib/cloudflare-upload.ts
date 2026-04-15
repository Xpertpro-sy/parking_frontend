import { getAccessToken } from "@/context/AuthContext";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8080";

type PresignUploadResponse = {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
};

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
  const presignResponse = await fetch(`${API_BASE_URL}/api/auth/uploads/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
    }),
  });

  if (!presignResponse.ok) {
    if (presignResponse.status === 401) {
      sessionStorage.clear();
      window.location.href = "/login";
    }
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

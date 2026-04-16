export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/presign-upload") {
      return json({ error: "Route introuvable." }, 404);
    }

    if (request.method !== "POST") {
      return json({ error: "Methode non autorisee." }, 405);
    }

    const authHeader = request.headers.get("Authorization") || "";
    const token = extractBearerToken(authHeader);
    if (!token) {
      return json({ error: "Token manquant." }, 401);
    }

    const firebaseUser = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
    if (!firebaseUser?.uid || !firebaseUser?.email) {
      return json({ error: "Token Firebase invalide." }, 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return json({ error: "Fichier image manquant." }, 400);
    }

    const contentType = (file.type || "application/octet-stream").toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(contentType)) {
      return json({ error: "Type d'image non supporte." }, 400);
    }

    const extension = resolveExtension(contentType);
    const safeUid = firebaseUser.uid.replace(/[^a-zA-Z0-9_-]/g, "_");
    const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
    const objectKey = `vehicles/${safeUid}/${datePath}/${crypto.randomUUID()}.${extension}`;

    await env.R2_BUCKET.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType,
      },
    });

    const base = (env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    if (!base) {
      return json({ error: "Configuration R2_PUBLIC_BASE_URL manquante." }, 500);
    }

    return json({
      objectKey,
      publicUrl: `${base}/${objectKey}`,
    });
  },
};

function resolveExtension(contentType) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.trim()) return null;
  const [scheme, token] = authorizationHeader.trim().split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

async function verifyFirebaseToken(idToken, projectId) {
  if (!projectId) return null;
  const endpoint = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  try {
    const response = await fetch(endpoint);
    if (response.ok) {
      const payload = await response.json();
      if (String(payload.aud || "").trim() === String(projectId).trim()) {
        return {
          uid: String(payload.sub || "").trim(),
          email: String(payload.email || "").trim().toLowerCase(),
        };
      }
    }
  } catch {
    // Fallback below
  }

  const decoded = decodeJwtPayload(idToken);
  if (!decoded) return null;

  const aud = String(decoded.aud || "").trim();
  const iss = String(decoded.iss || "").trim();
  const sub = String(decoded.sub || "").trim();
  const email = String(decoded.email || "").trim().toLowerCase();
  const expectedIss = `https://securetoken.google.com/${projectId}`;

  if (aud !== projectId) return null;
  if (iss !== expectedIss) return null;
  if (!sub || !email) return null;

  return { uid: sub, email };
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4 || 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

/**
 * Crée ou met à jour le compte Firebase Auth + document Firestore `users` (role SUPER_ADMIN).
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/votre-projet-firebase-adminsdk-xxxxx.json"
 *   (remplacez par le chemin RÉEL du fichier JSON : Console Firebase → Paramètres → Comptes de service → Clé privée)
 *   export SUPER_ADMIN_PASSWORD='votre_mot_de_passe'
 *   npm run seed:super-admin
 *
 * Email par défaut : SUPER_ADMIN_EMAIL ou sytechsy@gmail.com.
 * Ne commitez pas le mot de passe : passez-le uniquement en variable d’environnement.
 */

import admin from "firebase-admin";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_EMAIL = "sytechsy@gmail.com";
const email = (process.env.SUPER_ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();

const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
if (!password) {
  console.error("Définissez SUPER_ADMIN_PASSWORD (ex. export SUPER_ADMIN_PASSWORD='...').");
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
const looksLikePlaceholder =
  credPath &&
  (/VOTRE-fichier|xxxxx|votre-projet|nomduprojet/i.test(credPath) || /\/chemin\//i.test(credPath));
if (credPath && !existsSync(credPath)) {
  console.error(`
Fichier introuvable :
  ${credPath}
${looksLikePlaceholder ? `
Vous utilisez encore un NOM D'EXEMPLE (VOTRE-fichier, xxxxx, etc.). Ce n'est pas le vrai nom du fichier.

1. Firebase Console → Paramètres du projet → Comptes de service
2. « Générer une nouvelle clé privée » → un fichier se télécharge, ex. :
   gestion-parking-firebase-adminsdk-abc12-1234567890.json
3. Utilisez ce nom exact, par exemple :
   export GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/gestion-parking-firebase-adminsdk-abc12-1234567890.json"
` : `
Vérifiez le chemin (fichier déplacé ou renommé ?). Obtenez une nouvelle clé : Firebase → Comptes de service → Générer une nouvelle clé privée.
`}
`);
  process.exit(1);
}

function loadFirebaseConfigFromEnv() {
  const path = process.env.FIREBASE_WEB_CONFIG_JSON;
  if (path) {
    return JSON.parse(readFileSync(path, "utf8"));
  }
  const rootEnv = join(__dirname, "..", ".env");
  try {
    const raw = readFileSync(rootEnv, "utf8");
    const map = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^VITE_FIREBASE_(\w+)=(.*)$/);
      if (!m) continue;
      map[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    if (map.PROJECT_ID) {
      return { projectId: map.PROJECT_ID };
    }
  } catch {
    /* ignore */
  }
  return { projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT };
}

if (!admin.apps.length) {
  const cfg = loadFirebaseConfigFromEnv();
  if (cfg.projectId) {
    admin.initializeApp({ projectId: cfg.projectId });
  } else {
    admin.initializeApp();
  }
}

const auth = admin.auth();
const db = admin.firestore();

async function main() {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password, displayName: "Super administrateur" });
    console.log("Utilisateur Auth existant mis à jour (mot de passe / displayName).", userRecord.uid);
  } catch (e) {
    if (e?.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: "Super administrateur",
        emailVerified: false,
      });
      console.log("Utilisateur Auth créé.", userRecord.uid);
    } else {
      throw e;
    }
  }

  const uid = userRecord.uid;
  const userRef = db.doc(`users/${uid}`);
  const existing = await userRef.get();
  const payload = {
    uid,
    email,
    prenom: "Super",
    nom: "Administrateur",
    displayName: "Super administrateur",
    telephone: null,
    role: "SUPER_ADMIN",
    enterpriseOwnerUid: uid,
    permissions: {
      dashboard: true,
      vehicles: true,
      receipts: true,
      comptability: true,
      rentals: true,
      reservations: true,
      history: true,
      trash: true,
      settings: true,
      accounts: true,
    },
    managerStatus: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!existing.exists) {
    payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await userRef.set(payload, { merge: true });

  console.log(JSON.stringify({ ok: true, email, uid, firestore: `users/${uid}` }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

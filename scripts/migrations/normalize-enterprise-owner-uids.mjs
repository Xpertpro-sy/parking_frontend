/**
 * Migration : normalise le workspace ownerUid vers l'admin d'entreprise.
 *
 * Objectif :
 * - Corriger les anciens documents créés avec ownerUid = managerUid.
 * - Forcer ownerUid = enterpriseOwnerUid (admin) pour éviter les refus de règles.
 * - Corriger aussi users/{managerUid}.enterpriseOwnerUid manquant via managerAccess.
 *
 * Prérequis :
 *   npm install
 *   export GOOGLE_APPLICATION_CREDENTIALS="/chemin/vers/serviceAccount.json"
 *   (ou : gcloud auth application-default login)
 *
 * Exécution :
 *   npm run migrate:normalize-enterprise-owner-uids
 *
 * Idempotent : relancer le script ne modifie plus rien après la première passe.
 */

import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

function resolveProjectId() {
  const fromEnv =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    "";
  if (fromEnv.trim()) return fromEnv.trim();

  const rcPath = path.resolve(process.cwd(), ".firebaserc");
  if (fs.existsSync(rcPath)) {
    try {
      const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
      const fromRc = rc?.projects?.default;
      if (typeof fromRc === "string" && fromRc.trim()) return fromRc.trim();
    } catch {
      // Ignore parse errors and fallback to explicit error below.
    }
  }

  throw new Error(
    "Project ID introuvable. Définissez GOOGLE_CLOUD_PROJECT (ou FIREBASE_PROJECT_ID), " +
      "ou configurez le projet par défaut dans .firebaserc.",
  );
}

const projectId = resolveProjectId();

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();
const BATCH_MAX = 400;

const COLLECTIONS_WITH_OWNER_UID = [
  "vehicles",
  "rentals",
  "rentalReceipts",
  "reservations",
  "repairs",
  "accountMovements",
  "sales",
  "saleReceipts",
  "trashItems",
  "subscriptionRequests",
];

async function buildManagerOwnerMap() {
  const usersSnap = await db.collection("users").where("role", "==", "GESTIONNAIRE").get();
  const byManagerUid = new Map();
  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data() ?? {};
    const ownerUid =
      typeof data.enterpriseOwnerUid === "string" ? data.enterpriseOwnerUid.trim() : "";
    if (!ownerUid) continue;
    byManagerUid.set(docSnap.id, ownerUid);
  }
  return byManagerUid;
}

async function enrichManagerOwnerMapFromManagerAccess(byManagerUid) {
  const accessSnap = await db.collection("managerAccess").get();
  let linked = 0;
  for (const docSnap of accessSnap.docs) {
    const data = docSnap.data() ?? {};
    const managerUid = typeof data.managerUid === "string" ? data.managerUid.trim() : "";
    const ownerUid = typeof data.ownerUid === "string" ? data.ownerUid.trim() : "";
    if (!managerUid || !ownerUid) continue;
    if (!byManagerUid.has(managerUid)) {
      byManagerUid.set(managerUid, ownerUid);
      linked += 1;
    }
  }
  return linked;
}

async function fixManagerProfiles(byManagerUid) {
  const usersSnap = await db.collection("users").where("role", "==", "GESTIONNAIRE").get();
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let ops = 0;

  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data() ?? {};
    const managerUid = docSnap.id;
    const expectedOwnerUid = byManagerUid.get(managerUid);
    if (!expectedOwnerUid) {
      skipped += 1;
      continue;
    }
    const currentOwnerUid =
      typeof data.enterpriseOwnerUid === "string" ? data.enterpriseOwnerUid.trim() : "";
    if (currentOwnerUid === expectedOwnerUid) {
      skipped += 1;
      continue;
    }
    batch.set(
      docSnap.ref,
      {
        enterpriseOwnerUid: expectedOwnerUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    ops += 1;
    updated += 1;
    if (ops >= BATCH_MAX) await commit();
  }

  await commit();
  return { totalDocs: usersSnap.size, updated, skipped };
}

async function migrateCollectionOwnerUid(collectionName, byManagerUid) {
  const snap = await db.collection(collectionName).get();
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let ops = 0;

  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const docSnap of snap.docs) {
    const data = docSnap.data() ?? {};
    const currentOwnerUid = typeof data.ownerUid === "string" ? data.ownerUid.trim() : "";
    if (!currentOwnerUid) {
      skipped += 1;
      continue;
    }
    const normalizedOwnerUid = byManagerUid.get(currentOwnerUid);
    if (!normalizedOwnerUid || normalizedOwnerUid === currentOwnerUid) {
      skipped += 1;
      continue;
    }

    batch.set(
      docSnap.ref,
      {
        ownerUid: normalizedOwnerUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    ops += 1;
    updated += 1;
    if (ops >= BATCH_MAX) await commit();
  }

  await commit();
  return { collection: collectionName, totalDocs: snap.size, updated, skipped };
}

async function main() {
  const managerOwnerMap = await buildManagerOwnerMap();
  const linkedFromAccess = await enrichManagerOwnerMapFromManagerAccess(managerOwnerMap);

  const profileResult = await fixManagerProfiles(managerOwnerMap);
  const collectionResults = [];
  for (const col of COLLECTIONS_WITH_OWNER_UID) {
    // eslint-disable-next-line no-await-in-loop
    const result = await migrateCollectionOwnerUid(col, managerOwnerMap);
    collectionResults.push(result);
  }

  console.log(
    JSON.stringify(
      {
        managersMapped: managerOwnerMap.size,
        managersLinkedFromManagerAccess: linkedFromAccess,
        managerProfiles: profileResult,
        collections: collectionResults,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


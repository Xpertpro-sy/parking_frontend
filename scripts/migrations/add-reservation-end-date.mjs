/**
 * Migration : ajoute reservationEndDate: null sur les documents reservations
 * qui n'ont pas encore ce champ (rétrocompatibilité avec l'app après ajout de la fenêtre de dates).
 *
 * Prérequis :
 *   npm install
 *   export GOOGLE_APPLICATION_CREDENTIALS="/chemin/vers/serviceAccount.json"
 *   (ou utiliser les identifiants par défaut gcloud : gcloud auth application-default login)
 *
 * Exécution :
 *   npm run migrate:reservation-end-date
 *
 * Idempotent : les documents qui ont déjà reservationEndDate (date ou null) sont ignorés.
 */

import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const BATCH_MAX = 400;

async function main() {
  const snap = await db.collection("reservations").get();
  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchOps = 0;

  const commit = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.reservationEndDate !== undefined) {
      skipped += 1;
      continue;
    }
    batch.update(docSnap.ref, { reservationEndDate: null });
    batchOps += 1;
    updated += 1;
    if (batchOps >= BATCH_MAX) {
      await commit();
    }
  }

  await commit();

  console.log(
    JSON.stringify(
      {
        collection: "reservations",
        totalDocs: snap.size,
        updated,
        skipped,
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

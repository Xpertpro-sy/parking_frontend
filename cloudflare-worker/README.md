# Cloudflare Worker upload (sans Spring, sans Firebase Functions)

Ce worker recoit un fichier image depuis le frontend, verifie le token Firebase, puis enregistre l'image dans Cloudflare R2.
Il renvoie ensuite `publicUrl` que le frontend stocke dans Firestore (`vehicles.photos[]`).

## 1) Prerequis

- Bucket R2 cree (ex: `gestionparking-images`)
- URL publique R2 (ex: `https://pub-xxx.r2.dev`)
- Projet Firebase (pour verifier les ID tokens)

## 2) Configuration Worker (Wrangler)

Variables d'environnement Worker:

- `FIREBASE_PROJECT_ID=parking-506c1`
- `R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev`

Binding R2:

- `R2_BUCKET` -> ton bucket R2

## 3) Route exposee

- `POST /presign-upload`
- Header: `Authorization: Bearer <firebase_id_token>`
- Body (multipart/form-data): `file=<image>`

Reponse:

```json
{
  "objectKey": "vehicles/<uid>/YYYY/MM/DD/<uuid>.jpg",
  "publicUrl": "https://pub-xxx.r2.dev/vehicles/<uid>/YYYY/MM/DD/<uuid>.jpg"
}
```

## 4) Frontend

Dans `.env`:

```env
VITE_CLOUDFLARE_PRESIGN_URL=https://<ton-worker>.workers.dev/presign-upload
```

Le frontend enverra l'image au worker, puis conservera uniquement `publicUrl` dans Firestore.

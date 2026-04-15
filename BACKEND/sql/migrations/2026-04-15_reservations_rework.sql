-- Migration: reservations -> ajout des champs metier
-- SGBD cible: MySQL 8+ / TiDB (compatible MySQL)
-- Objectif:
--   1) remplacer reserved_until par reservation_date (jour de reservation)
--   2) ajouter amount_paid (montant paye)
--   3) ajouter cancelled_at pour tracer l'annulation

START TRANSACTION;

-- 1) Ajouter les nouvelles colonnes en nullable d'abord (migration sans casse)
ALTER TABLE reservations
  ADD COLUMN reservation_date DATE NULL AFTER notes,
  ADD COLUMN amount_paid DECIMAL(12,2) NULL AFTER reservation_date,
  ADD COLUMN cancelled_at DATETIME NULL AFTER status;

-- 2) Backfill des anciennes donnees
-- reservation_date: priorite a reserved_until, sinon created_at, sinon date du jour
UPDATE reservations
SET reservation_date = COALESCE(DATE(reserved_until), DATE(created_at), CURRENT_DATE)
WHERE reservation_date IS NULL;

-- amount_paid: valeur par defaut 0 pour les anciennes reservations
UPDATE reservations
SET amount_paid = 0
WHERE amount_paid IS NULL;

-- 3) Rendre les colonnes obligatoires apres backfill
ALTER TABLE reservations
  MODIFY COLUMN reservation_date DATE NOT NULL,
  MODIFY COLUMN amount_paid DECIMAL(12,2) NOT NULL;

-- 4) Supprimer l'ancienne colonne obsolete
ALTER TABLE reservations
  DROP COLUMN reserved_until;

-- 5) Index utiles pour les APIs (listings/annulation)
CREATE INDEX idx_reservations_owner_created_at ON reservations(owner_user_id, created_at);
CREATE INDEX idx_reservations_vehicle_status ON reservations(vehicle_id, status);

COMMIT;


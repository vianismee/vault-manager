-- ============================================================
-- Migration: Legacy Data Migration Support Columns
-- Phase 2.5 — Migrate CryptoJS flat records to credential chain
-- Tasks: TASK-023B, TASK-023C
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TASK-023B: Add migration_status + migrated_from_legacy
--            to vault_chains
-- ────────────────────────────────────────────────────────────
ALTER TABLE vault_chains
  ADD COLUMN IF NOT EXISTS migration_status TEXT NOT NULL DEFAULT 'none'
    CHECK (migration_status IN ('none', 'in_progress', 'completed', 'rolled_back')),
  ADD COLUMN IF NOT EXISTS migrated_from_legacy BOOLEAN NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- TASK-023C: Add legacy_row_id to chain_blocks
--            Stores original credentials.id for migrated rows,
--            enabling traceability and rollback.
-- ────────────────────────────────────────────────────────────
ALTER TABLE chain_blocks
  ADD COLUMN IF NOT EXISTS legacy_row_id UUID;

-- Index for rollback queries (delete all blocks with legacy_row_id IS NOT NULL)
CREATE INDEX IF NOT EXISTS idx_chain_blocks_legacy_row_id
  ON chain_blocks (chain_id, legacy_row_id)
  WHERE legacy_row_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- Add migrated_at to legacy credentials table (TASK-023H)
-- Marks rows as archived after user confirms migration.
-- Rows are NEVER deleted — only archived.
--
-- Uses IF EXISTS so this migration is safe to run even when
-- the credentials table was created outside the migrations
-- folder (e.g. via setup.sql run directly in Supabase editor).
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credentials'
  ) THEN
    -- Add migrated_at column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'credentials'
        AND column_name = 'migrated_at'
    ) THEN
      ALTER TABLE credentials ADD COLUMN migrated_at TIMESTAMPTZ;
    END IF;

    -- Create index if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename  = 'credentials'
        AND indexname  = 'idx_credentials_migrated_at'
    ) THEN
      CREATE INDEX idx_credentials_migrated_at
        ON credentials (user_id, migrated_at)
        WHERE migrated_at IS NOT NULL;
    END IF;

    RAISE NOTICE 'credentials.migrated_at column ensured.';
  ELSE
    RAISE NOTICE 'credentials table not found — skipping migrated_at column (run setup.sql first if needed).';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- TASK-023J: Mark legacy shared_credentials as expired
--            at migration time (handled by migrate-vault.ts,
--            column pre-created here for schema completeness)
-- ────────────────────────────────────────────────────────────
-- shared_credentials.status already has 'expired' as a valid
-- value per the existing migration. No schema change needed.

-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Phase 2.5: legacy migration columns added successfully.';
END $$;

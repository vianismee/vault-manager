-- ============================================================
-- Migration: Credential Chain Schema
-- Phase 2 — Blockchain-Inspired Vault Architecture
-- Tasks: TASK-009, TASK-010, TASK-011
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. vault_chains
--    One chain per user vault. genesis block lives here.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_chains (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID    REFERENCES auth.users NOT NULL,
  -- Public key stored as hex (Ed25519, 32 bytes → 64 hex chars)
  public_key      TEXT    NOT NULL,
  -- TASK-010: Emergency Kill Switch status (SEC-006)
  status          TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'frozen')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- One vault chain per user
  UNIQUE (user_id)
);

ALTER TABLE vault_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vault chain"
  ON vault_chains FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vault chain"
  ON vault_chains FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vault chain"
  ON vault_chains FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vault_chains_user_id ON vault_chains (user_id);

-- ────────────────────────────────────────────────────────────
-- 2. chain_blocks
--    Append-only log of all credential operations.
--    TASK-009: core table + UNIQUE + index
--    TASK-011: RLS — users may only read/write their own chain
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chain_blocks (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id        UUID    REFERENCES vault_chains (id) ON DELETE CASCADE NOT NULL,
  block_index     INTEGER NOT NULL,
  prev_hash       TEXT    NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL,
  nonce           TEXT    NOT NULL,
  -- AES-256-GCM encrypted CredentialPayload (base64)
  payload         TEXT    NOT NULL,
  block_hash      TEXT    NOT NULL,
  -- Ed25519 signature over block_hash (base64, 64 bytes)
  signature       TEXT    NOT NULL,
  -- SPHINCS+ signature — nullable until Phase PQ-2 (REQ-008)
  signature_pq    TEXT,
  -- Hidden canary flag (SEC-007)
  canary          BOOLEAN NOT NULL DEFAULT false,

  -- TASK-009: prevent duplicate indices in same chain
  UNIQUE (chain_id, block_index)
);

ALTER TABLE chain_blocks ENABLE ROW LEVEL SECURITY;

-- TASK-011: users may only read/write chain_blocks for their own vault_chain
CREATE POLICY "Users can read own chain blocks"
  ON chain_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vault_chains
      WHERE vault_chains.id = chain_blocks.chain_id
        AND vault_chains.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own chain blocks"
  ON chain_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vault_chains
      WHERE vault_chains.id = chain_blocks.chain_id
        AND vault_chains.user_id = auth.uid()
        AND vault_chains.status = 'active'
    )
  );

-- No UPDATE / DELETE policies — append-only (REQ-003)

-- TASK-009: required index
CREATE INDEX IF NOT EXISTS idx_blocks_chain_index
  ON chain_blocks (chain_id, block_index);

-- Extra index for canary monitoring (SEC-007)
CREATE INDEX IF NOT EXISTS idx_blocks_canary
  ON chain_blocks (chain_id, canary)
  WHERE canary = true;

-- ────────────────────────────────────────────────────────────
-- 3. vault_identities
--    Stores the vault's Ed25519 public key (and future PQ key).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_identities (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id        UUID    REFERENCES vault_chains (id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id         UUID    REFERENCES auth.users NOT NULL,
  -- Ed25519 public key (hex, 64 chars)
  ed25519_public_key  TEXT NOT NULL,
  -- ML-KEM-768 public key — nullable until Phase PQ-1 (TASK-039)
  pq_public_key   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vault_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vault identity"
  ON vault_identities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vault identity"
  ON vault_identities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vault identity"
  ON vault_identities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vault_identities_chain_id
  ON vault_identities (chain_id);

CREATE INDEX IF NOT EXISTS idx_vault_identities_user_id
  ON vault_identities (user_id);

-- ────────────────────────────────────────────────────────────
-- 4. authorized_devices
--    Tracks devices approved to access the vault (REQ-012, SEC-005).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authorized_devices (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id        UUID    REFERENCES vault_chains (id) ON DELETE CASCADE NOT NULL,
  user_id         UUID    REFERENCES auth.users NOT NULL,
  -- Ed25519 public key of the device
  device_pubkey   TEXT    NOT NULL,
  device_name     TEXT,
  -- Vault master key encrypted for this device's pubkey (X25519 ECDH)
  encrypted_vault_key TEXT,
  status          TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'revoked')),
  -- Ed25519-signed revoke payload (SEC-005)
  revoke_signature TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,

  UNIQUE (chain_id, device_pubkey)
);

ALTER TABLE authorized_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own authorized devices"
  ON authorized_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own authorized devices"
  ON authorized_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own authorized devices"
  ON authorized_devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_authorized_devices_chain_id
  ON authorized_devices (chain_id);

CREATE INDEX IF NOT EXISTS idx_authorized_devices_user_id
  ON authorized_devices (user_id);

-- ────────────────────────────────────────────────────────────
-- 5. vault_sessions
--    Active JWT-linked sessions; all invalidated by kill switch (SEC-006).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_sessions (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id        UUID    REFERENCES vault_chains (id) ON DELETE CASCADE NOT NULL,
  user_id         UUID    REFERENCES auth.users NOT NULL,
  device_id       UUID    REFERENCES authorized_devices (id) ON DELETE CASCADE,
  jwt_jti         TEXT    NOT NULL UNIQUE,   -- JWT ID for precise invalidation
  status          TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'revoked', 'expired')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ
);

ALTER TABLE vault_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vault sessions"
  ON vault_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vault sessions"
  ON vault_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vault sessions"
  ON vault_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vault_sessions_chain_id
  ON vault_sessions (chain_id);

CREATE INDEX IF NOT EXISTS idx_vault_sessions_user_id
  ON vault_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_vault_sessions_jti
  ON vault_sessions (jwt_jti);

-- ────────────────────────────────────────────────────────────
-- 6. canary_blocks
--    Server-side canary monitoring (SEC-007, TASK-022).
--    No client RLS select policy — server-only.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canary_blocks (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  chain_id        UUID    REFERENCES vault_chains (id) ON DELETE CASCADE NOT NULL,
  block_id        UUID    REFERENCES chain_blocks (id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- Unique token that identifies this canary if used externally
  canary_token    TEXT    NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  triggered_at    TIMESTAMPTZ,
  alert_sent      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS select for client — server-only table (SEC-007, TASK-011)
ALTER TABLE canary_blocks ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; no client policy needed.

CREATE INDEX IF NOT EXISTS idx_canary_blocks_chain_id
  ON canary_blocks (chain_id);

CREATE INDEX IF NOT EXISTS idx_canary_blocks_token
  ON canary_blocks (canary_token);

-- ────────────────────────────────────────────────────────────
-- 7. updated_at trigger (reuse existing function if present)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vault_chains_updated_at ON vault_chains;
CREATE TRIGGER trg_vault_chains_updated_at
  BEFORE UPDATE ON vault_chains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vault_identities_updated_at ON vault_identities;
CREATE TRIGGER trg_vault_identities_updated_at
  BEFORE UPDATE ON vault_identities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Phase 2: credential chain schema created successfully.';
END $$;

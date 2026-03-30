---
goal: Refactor vault-manager to blockchain-inspired credential chain with post-quantum cryptography
version: 1.2
date_created: 2026-03-30
last_updated: 2026-03-30
owner: vault-manager team
status: 'Phase 4 Complete — Phase 5 & PQ pending'
tags: [architecture, security, cryptography, refactor, migration]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Refactor the existing flat-record credential storage into a **credential chain** — a blockchain-inspired structure where each credential entry is a cryptographically linked "block". Access control migrates from magic-link-only to a **BIP-39 seedphrase** as the single source of truth for vault key derivation. The architecture adds tamper-evidence, credential version history, zero-knowledge multi-device auth, and a hybrid post-quantum signature layer (Ed25519 + SPHINCS+) to future-proof the vault against "Harvest Now, Decrypt Later" attacks.

---

## 1. Requirements & Constraints

- **REQ-001**: Every credential entry must be represented as an immutable block with `block_index`, `prev_hash`, `nonce`, `payload` (AES-256-GCM encrypted), `block_hash`, and `signature` (Ed25519).
- **REQ-002**: A Genesis Block (Block 0) with `prev_hash = "0000...0000"` must be created at vault initialization.
- **REQ-003**: DELETE operations must not remove blocks physically; they must append a new block with `op: "DELETE"` to preserve full audit trail.
- **REQ-004**: BIP-39 mnemonic (12 or 24 words) replaces master password as the sole vault key source.
- **REQ-005**: HD key derivation paths: `m/vault/0` (AES-256 vault key), `m/identity/0` (Ed25519 keypair), `m/hmac/0` (HMAC signing), `m/cat/N` (per-category keys), `m/pq/sign/0` (SPHINCS+), `m/pq/kem/0` (ML-KEM-768).
- **REQ-006**: Client must perform chain walk on vault open to verify `prev_hash` integrity; tamper detection triggers read-only mode.
- **REQ-007**: Vault state reconstruction (current credential set) must be derived entirely client-side via chain replay — server never decrypts payloads.
- **REQ-008**: `signature_pq` field (SPHINCS+-SHA2-256s) must be nullable in Phase PQ-1 and required in Phase PQ-2.
- **REQ-009**: PQ Anchor Blocks must be generated every 50 blocks — one SPHINCS+ signature covers a Merkle root of 50 blocks.
- **REQ-010**: Vault sharing (F8) must use X25519 ECDH in Phase PQ-1, migrating to ML-KEM-768 in Phase PQ-2.
- **REQ-011**: All CryptoKey objects must be created with `extractable: false`.
- **REQ-012**: Vault keys must be wrapped with a WebAuthn/Secure Enclave device-bound key and stored in IndexedDB as `wrapped_vault_key`.
- **REQ-013**: Auto-lock must trigger on inactivity (configurable, default 2 min), Page Visibility change, screen lock, or explicit user action.
- **REQ-014**: Clipboard-copied passwords and OTPs must auto-clear after 30 seconds.
- **REQ-015**: Seedphrase must never be transmitted to the server.
- **SEC-001**: Content Security Policy header: `default-src 'self'; script-src 'self' 'sha256-<hash>'; connect-src 'self' https://*.supabase.co; object-src 'none'`.
- **SEC-002**: All external scripts must include Subresource Integrity (SRI) `integrity` attribute.
- **SEC-003**: Seedphrase input field must not allow paste (`preventDefault` on paste event) to mitigate clipboard sniffers.
- **SEC-004**: Raw seedphrase bytes and master seed bytes must be zero-filled (`fill(0)`) immediately after CryptoKey derivation.
- **SEC-005**: Remote device revoke must use an Ed25519-signed revoke payload verified by the server using the vault's public key.
- **SEC-006**: Emergency Kill Switch (F10) must freeze vault, revoke all authorized devices, and invalidate all active JWTs without deleting chain blocks.
- **SEC-007**: Canary blocks must be hidden from normal UI (`canary: true` flag) and monitored server-side for usage triggers.
- **CON-001**: `@noble/post-quantum` library is still in beta — PQ implementation is a parallel track (Phase PQ-1/2/3) and must not block Phases 1–5.
- **CON-002**: SPHINCS+-SHA2-256s signatures are 7,856 bytes — PQ Anchor Block strategy (every 50 blocks) must be used to limit storage impact.
- **CON-003**: SPHINCS+ signing is ~6 ops/second in browser WASM — signing must run in a Web Worker, never blocking the UI thread.
- **CON-004**: WebAuthn Secure Enclave requires modern browser + compatible hardware; PIN-based Argon2id key wrapping must be provided as fallback.
- **GUD-001**: Follow zero-knowledge principle throughout — server stores only encrypted bytes and public keys, never plaintext or private keys.
- **GUD-002**: All crypto modules must have comprehensive unit tests before integration.
- **GUD-003**: Vault sharing protocol versions must be explicit (`v1: X25519`, `v2: ML-KEM`) for backward compatibility.
- **PAT-001**: Use `extractable: false` Web Crypto API pattern for all symmetric key operations.
- **PAT-002**: Use BIP-32-inspired HD derivation for deterministic key generation from seedphrase.
- **PAT-003**: Git-rebase-style conflict resolution for offline/multi-device chain conflicts (timestamp-based deterministic rebase).

---

## 2. Implementation Steps

### Implementation Phase 1 — Foundation (Core Crypto)

- GOAL-001: Build the cryptographic primitives layer: BIP-39 seedphrase, HD key derivation, Ed25519 keypair, AES-256-GCM block cipher, block assembly, and chain integrity verification with full unit test coverage.

| Task     | Description                                                                                                                                                                                                                                                                                                       | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-001 | Create `src/lib/crypto/` directory structure with all 13 module files: `seedphrase.ts`, `hd-keys.ts`, `keypair.ts`, `post-quantum.ts`, `hybrid-sig.ts`, `block-cipher.ts`, `chain.ts`, `pq-anchor.ts`, `secure-enclave.ts`, `session-guard.ts`, `sharing.ts`, `device-auth.ts`, `canary.ts`, `sss.ts`, `index.ts` | ✅ | 2026-03-30 |
| TASK-002 | Implement `seedphrase.ts`: BIP-39 mnemonic generation (12/24 words) using `@scure/bip39`, validate mnemonic, and extract 512-bit entropy via PBKDF2/Argon2id                                                                                                                                                      | ✅ | 2026-03-30 |
| TASK-003 | Implement `hd-keys.ts`: BIP-32-inspired HD key derivation for paths `m/vault/0`, `m/vault/1`, `m/hmac/0`, `m/cat/N`, `m/identity/0`, `m/pq/sign/0`, `m/pq/kem/0` from master seed                                                                                                                                 | ✅ | 2026-03-30 |
| TASK-004 | Implement `keypair.ts`: Ed25519 keypair derivation from `m/identity/0`, `sign(message, privKey)`, `verify(message, signature, pubKey)`, and X25519 conversion for ECDH key exchange                                                                                                                               | ✅ | 2026-03-30 |
| TASK-005 | Implement `block-cipher.ts`: AES-256-GCM encrypt/decrypt using Web Crypto API with `extractable: false` CryptoKey; zero-out raw key bytes after `importKey`                                                                                                                                                       | ✅ | 2026-03-30 |
| TASK-006 | Implement `chain.ts`: Block creation (assemble all fields, compute `block_hash = SHA-256(block_index + timestamp + prev_hash + nonce + payload)`), chain assembly, chain integrity walk (verify `prev_hash` linkage), and signature verification                                                                  | ✅ | 2026-03-30 |
| TASK-007 | Implement `session-guard.ts`: Auto-lock timer (configurable, default 2 min), Page Visibility API listener, CryptoKey reference nullification on lock, clipboard auto-clear after 30 seconds                                                                                                                       | ✅ | 2026-03-30 |
| TASK-008 | Write unit tests for all Phase 1 crypto modules — seedphrase roundtrip, key derivation determinism, block hash computation, chain walk pass/fail, signature sign/verify, AES encrypt/decrypt                                                                                                                      | ✅ | 2026-03-30 |

### Implementation Phase 2 — Data Layer

- GOAL-002: Migrate the PostgreSQL schema from flat credential records to credential chain tables, update Supabase RLS policies, implement API endpoints for block operations, and build the client-side chain replay engine.

| Task     | Description                                                                                                                                                                                                                                      | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-009 | Write Supabase migration: create `vault_chains`, `chain_blocks` (with `UNIQUE(chain_id, block_index)` and `idx_blocks_chain_index` index), `vault_identities`, `authorized_devices`, `vault_sessions`, `canary_blocks` tables as defined in docs | ✅ | 2026-03-30 |
| TASK-010 | Add `status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen'))` column to `vault_chains` for emergency kill switch                                                                                                                     | ✅ | 2026-03-30 |
| TASK-011 | Update Supabase RLS policies: users may only read/write `chain_blocks` where `chain_id` matches their own `vault_chains.id`; `canary_blocks` is server-only (no client RLS select policy)                                                        | ✅ | 2026-03-30 |
| TASK-012 | Implement Supabase Edge Function or API route `POST /api/blocks/append`: validate Ed25519 signature against vault's stored public key, verify `prev_hash` matches current HEAD, append block; reject if vault status is `frozen`                 | ✅ | 2026-03-30 |
| TASK-013 | Implement API route `GET /api/blocks/:chainId`: return all blocks ordered by `block_index` ascending; server returns ciphertext only                                                                                                             | ✅ | 2026-03-30 |
| TASK-014 | Implement client-side chain replay engine in `chain.ts`: `replayChain(blocks, decryptFn)` — decrypt each block's payload, apply `op: CREATE/UPDATE/DELETE` operations in order, return `Map<credentialId, latestPayload>` as current vault state | ✅ | 2026-03-30 |
| TASK-015 | Implement incremental sync: client stores last verified `block_index` in IndexedDB; subsequent fetches request only `block_index > lastSynced` and append to local chain cache                                                                   | ✅ | 2026-03-30 |

### Implementation Phase 3 — Auth Flow & Device Security

- GOAL-003: Implement the full onboarding/login UI with seedphrase generation and confirmation, WebAuthn Secure Enclave key wrapping, auto-lock behavior, remote device revoke, Emergency Kill Switch, Canary Block setup, and security headers.

| Task     | Description                                                                                                                                                                                                                                                          | Completed | Date |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-016 | Implement onboarding flow: generate 12/24-word seedphrase → display words → require user to confirm 3 randomly selected words → create Genesis Block → store `wrapped_vault_key` in IndexedDB                                                                        | ✅ | 2026-03-30 |
| TASK-017 | Implement `secure-enclave.ts`: WebAuthn credential creation for key binding, `wrapKey(vaultKey, deviceBoundKey)` → stores `wrapped_vault_key` in IndexedDB, `unwrapKey(wrappedKey, deviceBoundKey)` → returns non-extractable CryptoKey; Argon2id PIN-based fallback | ✅ | 2026-03-30 |
| TASK-018 | Implement login flow: magic link auth (existing) → WebAuthn biometric/PIN prompt → `unwrapKey` to get vault CryptoKey → fetch + verify chain → render vault state                                                                                                    | ✅ | 2026-03-30 |
| TASK-019 | Integrate `session-guard.ts` into app layout: start auto-lock timer after vault open, reset timer on user interaction, trigger lock on Page Visibility hidden event, expose "Lock Vault" button and `Ctrl+Shift+L` keyboard shortcut                                 | ✅ | 2026-03-30 |
| TASK-020 | Implement `device-auth.ts`: device keypair generation, device authorization request flow (new device sends `device_pubkey` → trusted device approves → encrypted `vault_master_key` sent back), device revoke with Ed25519-signed payload                            |           |      |
| TASK-021 | Implement Emergency Kill Switch UI (F10): signed `EMERGENCY_WIPE` command → server sets vault `status = frozen`, revokes all `authorized_devices`, invalidates all `vault_sessions`                                                                                  | ✅ | 2026-03-30 |
| TASK-022 | Implement `canary.ts`: inject canary block during vault setup (hidden from UI), server-side monitoring endpoint that marks `canary_blocks.triggered_at` and sends alert email when canary credential is used externally                                              |           |      |
| TASK-023 | Configure CSP headers in `next.config.ts`: `default-src 'self'`, `script-src 'self' 'sha256-<hash>'`, `connect-src 'self' https://*.supabase.co`, `object-src 'none'`; add SRI hashes to all external script tags                                                    | ✅ | 2026-03-30 |

### Implementation Phase 2.5 — Legacy Data Migration

- GOAL-003B: Migrate all existing credentials from the legacy flat-record system (`passwords` table, CryptoJS AES static key) into the new credential chain system (chain blocks, seedphrase-derived AES-256-GCM key), entirely client-side, without data loss and with full rollback capability.

> **Context**: The current `lib/encryption.ts` uses a static global `NEXT_PUBLIC_ENCRYPTION_KEY` (CryptoJS AES) shared across all users. This is not zero-knowledge. Migration must: (1) decrypt legacy data using the old static key on the client, (2) re-encrypt as chain blocks using the user's new seedphrase-derived key, (3) archive — not delete — the legacy rows until the user confirms migration success.

| Task      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Completed | Date |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-023B | Add `migration_status` column to `vault_chains`: `TEXT DEFAULT 'none' CHECK (migration_status IN ('none', 'in_progress', 'completed', 'rolled_back'))`; add `migrated_from_legacy BOOLEAN DEFAULT false` flag                                                                                                                                                                                                                                                                                                                                                                                                                                            | ✅ | 2026-03-30 |
| TASK-023C | Add `legacy_row_id UUID` column to `chain_blocks` table (nullable): stores the original `passwords.id` that was the source of a migrated block, enabling traceability and rollback                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ✅ | 2026-03-30 |
| TASK-023D | Implement `lib/crypto/legacy-decrypt.ts`: `decryptLegacy(encryptedValue: string, legacyKey: string): string` wrapping CryptoJS AES decrypt — isolated module used only during migration, never in normal vault operation                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅ | 2026-03-30 |
| TASK-023E | Implement `lib/migration/migrate-vault.ts`: `migrateVault(userId, legacyKey, seedphraseDerivedKey, chainId)` — (1) fetch all rows from `credentials` WHERE `user_id = userId`, (2) decrypt each field (`password_encrypted`, `totp_secret`) using `decryptLegacy`, (3) map row to block payload `{ id, type: 'login', title, username, password, url, totp_secret, tags: [category_name], op: 'CREATE', original_created_at }`, (4) encrypt payload with new AES-256-GCM key, (5) append as chain block with `legacy_row_id` set, (6) on any failure mid-migration, delete all blocks written in this batch and set `migration_status = 'rolled_back'` | ✅ | 2026-03-30 |
| TASK-023F | Implement migration detection on vault open: after user completes onboarding (seedphrase generated), check if `credentials` table has rows for this `user_id`; if yes, redirect to migration wizard before showing vault — `countLegacyCredentials()` helper in `migrate-vault.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✅ | 2026-03-30 |
| TASK-023G | Implement Migration Wizard UI (`app/migrate/page.tsx`): Step 1 — "We found N credentials from your old vault" → Step 2 — progress bar while migrating (show credential titles as they are processed) → Step 3 — "Migration complete. N credentials moved." + "Verify your vault looks correct before we archive the old data" → Step 4 — user clicks "Confirm & Archive"                                                                                                                                                                                                                                                                                 | ✅ | 2026-03-30 |
| TASK-023H | Implement archive step: after user confirms, set `credentials.migrated_at = NOW()` on all migrated rows; do NOT delete rows — mark them as archived; set `vault_chains.migration_status = 'completed'` — `archiveLegacyCredentials()` in `migrate-vault.ts`                                                                                                                                                                                                                                                                                                                                                                                                                          | ✅ | 2026-03-30 |
| TASK-023I | Implement rollback: delete all `chain_blocks` WHERE `legacy_row_id IS NOT NULL AND chain_id = chainId`; reset `vault_chains.migration_status = 'rolled_back'` — `rollbackMigration()` in `migrate-vault.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✅ | 2026-03-30 |
| TASK-023J | Handle `shared_credentials` table: set `status = 'expired'` for all records belonging to this user — implemented in `archiveLegacyCredentials()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✅ | 2026-03-30 |
| TASK-023K | Handle `categories` during migration: fetch `categories` rows for this user; build a `Map<categoryId, categoryName>`; use category name as the `tags` array in each migrated block payload — implemented in `migrateVault()`                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✅ | 2026-03-30 |
| TASK-023L | Write migration unit tests: mock `credentials` rows → run `migrateVault` → assert block count matches row count; assert `legacy_row_id` is set; assert mid-migration failure triggers full rollback (zero blocks written) | ✅ | 2026-03-30 |

### Implementation Phase 4 — Advanced Features

- GOAL-004: Surface the credential chain's historical data in the UI — version history, tamper-evident audit log, vault snapshot export/import, Shamir's Secret Sharing for seedphrase backup, and per-category key isolation.

| Task     | Description                                                                                                                                                                                                                                       | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-024 | Implement credential version history UI (F3): for a selected credential, list all blocks with `op: UPDATE` or `op: CREATE` showing masked value and timestamp; include "Restore" button that appends a new `UPDATE` block with historical payload | ✅ | 2026-03-30 |
| TASK-025 | Implement tamper-evident audit log UI (F2): display timeline of all chain blocks with `op` type, credential title, and timestamp; show TAMPER DETECTED marker for blocks failing integrity check                                                  | ✅ | 2026-03-30 |
| TASK-026 | Implement vault snapshot export (F5): serialize `{ vault_id, schema_version, chain_length, exported_at, blocks[], chain_root_hash }` as encrypted JSON file (re-encrypted with seedphrase-derived key), downloadable by user                      | ✅ | 2026-03-30 |
| TASK-027 | Implement vault snapshot import: upload snapshot file + input seedphrase → decrypt + verify `chain_root_hash` → replay chain → populate vault state                                                                                               | ✅ | 2026-03-30 |
| TASK-028 | Implement `sss.ts` Shamir's Secret Sharing (F4): `split(seedphrase, k=3, n=5)` → 5 shares, `combine(shares[])` → seedphrase; UI: generate shares, display each on separate screen, guide user to distribute                                       | ✅ | 2026-03-30 |
| TASK-029 | Implement per-category key isolation (F6): derive `m/cat/N` key per category index; encrypt blocks belonging to a category with that category's derived key; ensure category key exposure does not compromise other categories                    |           |      |

### Implementation Phase 5 — Keypair & Social Features

- GOAL-005: Implement vault identity, credential sharing via public key (ECDH), multi-device QR code pairing, and shared credential inbox.

| Task     | Description                                                                                                                                                                                                                                       | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-030 | Implement vault identity page: display Ed25519 public key as hex/base64 "vault address"; allow user to copy vault address to share with others                                                                                                    |           |      |
| TASK-031 | Implement `sharing.ts` Phase PQ-1: `shareCredential(credential, recipientPublicKey)` → generate ephemeral keypair → X25519 ECDH shared secret → AES-256-GCM encrypt → return `{ ephemeral_pubkey, encrypted_credential, protocol_version: 'v1' }` |           |      |
| TASK-032 | Implement `sharing.ts` receive: `receiveSharedCredential(encryptedPacket, vaultPrivKey)` → ECDH shared secret → AES decrypt → return plaintext credential                                                                                         |           |      |
| TASK-033 | Implement shared credential inbox UI: list incoming encrypted credential packets; user selects a packet, decrypts client-side, and optionally saves to vault (appends CREATE block)                                                               |           |      |
| TASK-034 | Implement multi-device QR code pairing UI (F9): new device generates keypair → encodes `device_pubkey` as QR → trusted device scans → approves in UI → encrypted vault key delivered                                                              |           |      |

### Implementation Phase PQ-1 — Post-Quantum Foundation

- GOAL-006: Integrate `@noble/post-quantum` library, derive SPHINCS+ and ML-KEM keypairs from seedphrase, add nullable `signature_pq` to block schema, and establish unit tests for all PQ primitives.

| Task     | Description                                                                                                                                                                                                 | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-035 | Install `@noble/post-quantum` package; verify SPHINCS+-SHA2-256s and ML-KEM-768 are available                                                                                                               |           |      |
| TASK-036 | Implement `post-quantum.ts`: SPHINCS+ keypair derivation from `m/pq/sign/0` seed, `sphincsSign(message, privKey)` → 7,856-byte signature, `sphincsVerify(message, signature, pubKey)` → boolean             |           |      |
| TASK-037 | Implement ML-KEM-768 in `post-quantum.ts`: keypair derivation from `m/pq/kem/0`, `kemEncapsulate(recipientPubKey)` → `{ ciphertext, sharedSecret }`, `kemDecapsulate(privKey, ciphertext)` → `sharedSecret` |           |      |
| TASK-038 | Add nullable `signature_pq TEXT` column to `chain_blocks` table via Supabase migration                                                                                                                      |           |      |
| TASK-039 | Add nullable `pq_public_key TEXT` column to `vault_identities` table for ML-KEM public key storage                                                                                                          |           |      |
| TASK-040 | Write unit tests: SPHINCS+ sign/verify roundtrip, ML-KEM encapsulate/decapsulate roundtrip, keypair determinism from same seed                                                                              |           |      |

### Implementation Phase PQ-2 — Hybrid Active

- GOAL-007: Activate hybrid dual signatures on all new blocks, implement PQ Anchor Blocks every 50 blocks, migrate vault sharing to ML-KEM-768, generate retroactive PQ anchors for existing chains, add detached signature store, and display "Quantum-Resistant" badge.

| Task     | Description                                                                                                                                                                                                                                                               | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-041 | Implement `hybrid-sig.ts`: `hybridSign(blockHash, ed25519PrivKey, sphincsPrivKey)` → `{ signature: 64B, signature_pq: 7856B }`; `hybridVerify(blockHash, bundle, ed25519PubKey, sphincsPubKey)` → valid only if both pass                                                 |           |      |
| TASK-042 | Update block creation in `chain.ts` to call `hybridSign` — all new blocks in Phase PQ-2 include both `signature` and `signature_pq` fields                                                                                                                                |           |      |
| TASK-043 | Implement `pq-anchor.ts` (F9 storage mitigation): every 50 blocks compute Merkle root of those block hashes; sign Merkle root with SPHINCS+; store anchor as a special block type `op: "PQ_ANCHOR"`                                                                       |           |      |
| TASK-044 | Create `chain_pq_signatures` table in Supabase: `{ id, chain_id, block_range_start, block_range_end, sphincs_signature, anchor_hash }`; client fetches this table only during full integrity audit, not on normal vault open                                              |           |      |
| TASK-045 | Update `sharing.ts` to Phase PQ-2: add `shareCredentialPQ(credential, recipientKemPubKey)` using ML-KEM-768 Encapsulate; output `{ kem_ciphertext, encrypted_credential, protocol_version: 'v2' }`; update receive to handle both `v1` (X25519) and `v2` (ML-KEM) packets |           |      |
| TASK-046 | Generate retroactive PQ anchors: for existing chain blocks lacking `signature_pq`, compute PQ Anchor Blocks in batches of 50 and insert into `chain_pq_signatures`                                                                                                        |           |      |
| TASK-047 | Add "Quantum-Resistant Vault" badge to vault UI — shown when PQ-2 is active (all new blocks dual-signed and ML-KEM sharing enabled)                                                                                                                                       |           |      |

---

## 3. Alternatives

- **ALT-001**: **Flat encrypted records (current approach)** — Simpler to implement but no tamper evidence, no credential history, no chain-based recovery, and no cryptographic identity. Rejected because it does not solve the tamper detection or historical audit requirements.
- **ALT-002**: **Master password instead of seedphrase** — More familiar UX but weaker entropy, vulnerable to brute force, and not device-agnostic for recovery. Rejected in favor of BIP-39 seedphrase (higher entropy, standardized, device-agnostic).
- **ALT-003**: **secp256k1 (Bitcoin curve) instead of Ed25519** — More ecosystem tooling but slower signing, larger signatures (71 bytes DER vs 64 bytes), and vulnerable to nonce reuse attacks. Rejected in favor of Ed25519.
- **ALT-004**: **ML-DSA (Dilithium) instead of SPHINCS+ for post-quantum signing** — ML-DSA is also NIST-standardized (FIPS 204) and faster, but SPHINCS+ is stateless and relies only on hash security (no lattice assumptions). Chosen SPHINCS+ for stronger security assumptions; ML-DSA can be added later as additional option.
- **ALT-005**: **Storing full SPHINCS+ signature on every block** — Provides per-block PQ integrity but costs 7.7 MB for 1,000 blocks. Rejected in favor of PQ Anchor Block (every 50 blocks) for storage efficiency.
- **ALT-006**: **Server-side chain compaction** — Merging old blocks into a snapshot to reduce storage. Possible future optimization but not in scope — risks losing audit trail if not carefully implemented.

---

## 4. Dependencies

- **DEP-001**: `@scure/bip39` — Audited BIP-39 mnemonic generation and entropy extraction
- **DEP-002**: `@noble/curves` — Ed25519 sign/verify and X25519 ECDH (already widely used in `@noble` ecosystem)
- **DEP-003**: `@noble/post-quantum` — SPHINCS+-SHA2-256s and ML-KEM-768 implementations (beta)
- **DEP-004**: `@noble/hashes` — SHA-256, HMAC, PBKDF2 for key derivation and block hashing
- **DEP-005**: Web Crypto API (browser-native) — AES-256-GCM encrypt/decrypt with `extractable: false`
- **DEP-006**: WebAuthn API (browser-native) — Secure Enclave / TPM key binding for `wrapped_vault_key`
- **DEP-007**: Supabase PostgreSQL — Chain block storage; RLS for per-user chain access
- **DEP-008**: Supabase Edge Functions or Next.js API routes — Block append validation and signature verification
- **DEP-009**: `argon2-browser` or `@noble/hashes` Argon2id — PIN-based key stretching as WebAuthn fallback
- **DEP-010**: Web Workers API (browser-native) — Offload SPHINCS+ signing (~6 ops/sec) to avoid blocking UI thread
- **DEP-011**: `crypto-js` (existing, already installed) — Used exclusively in `legacy-decrypt.ts` for one-time migration decryption of old CryptoJS AES ciphertext; must not be used for any new encryption operations

---

## 5. Files

- **FILE-001**: `src/lib/crypto/seedphrase.ts` — BIP-39 generation, validation, entropy extraction
- **FILE-002**: `src/lib/crypto/hd-keys.ts` — HD key derivation for all `m/*` paths
- **FILE-003**: `src/lib/crypto/keypair.ts` — Ed25519 keypair, sign, verify, X25519 conversion
- **FILE-004**: `src/lib/crypto/post-quantum.ts` — SPHINCS+-SHA2-256s and ML-KEM-768
- **FILE-005**: `src/lib/crypto/hybrid-sig.ts` — Hybrid signature bundle construction and verification
- **FILE-006**: `src/lib/crypto/block-cipher.ts` — AES-256-GCM encrypt/decrypt with non-extractable keys
- **FILE-007**: `src/lib/crypto/chain.ts` — Block creation, chain assembly, integrity walk, replay engine
- **FILE-008**: `src/lib/crypto/pq-anchor.ts` — PQ Anchor Block: Merkle root + SPHINCS+ signature every 50 blocks
- **FILE-009**: `src/lib/crypto/secure-enclave.ts` — WebAuthn key binding, wrap/unwrap vault key
- **FILE-010**: `src/lib/crypto/session-guard.ts` — Auto-lock timer, Page Visibility, memory scrubbing, clipboard clear
- **FILE-011**: `src/lib/crypto/sharing.ts` — Vault sharing: X25519 (v1) and ML-KEM-768 (v2)
- **FILE-012**: `src/lib/crypto/device-auth.ts` — Device keypair, authorization, revoke, emergency kill
- **FILE-013**: `src/lib/crypto/canary.ts` — Canary block injection and monitoring
- **FILE-014**: `src/lib/crypto/sss.ts` — Shamir's Secret Sharing split/combine
- **FILE-015**: `src/lib/crypto/index.ts` — Public API exports for all crypto modules
- **FILE-016**: `supabase/migrations/YYYYMMDD_blockchain_schema.sql` — New tables: `vault_chains`, `chain_blocks`, `vault_identities`, `authorized_devices`, `vault_sessions`, `canary_blocks`, `chain_pq_signatures`
- **FILE-017**: `supabase/migrations/YYYYMMDD_vault_freeze.sql` — `status` column on `vault_chains`, `signature_pq` on `chain_blocks`, PQ key columns on `vault_identities`
- **FILE-018**: `app/onboarding/` — Seedphrase generation, display, and confirmation UI pages
- **FILE-019**: `app/vault/` — Main vault UI, credential list, version history, audit log
- **FILE-020**: `next.config.ts` — CSP headers configuration
- **FILE-021**: `src/lib/crypto/workers/sphincs-sign.worker.ts` — Web Worker for background SPHINCS+ signing
- **FILE-022**: `src/lib/crypto/legacy-decrypt.ts` — Isolated CryptoJS AES decrypt wrapper used only during one-time legacy migration; not imported anywhere else
- **FILE-023**: `src/lib/migration/migrate-vault.ts` — Core migration engine: fetch legacy rows → decrypt → re-encrypt as chain blocks → rollback on failure
- **FILE-024**: `app/migrate/page.tsx` — Migration Wizard UI: 4-step flow (detect → progress → confirm → archive)

---

## 6. Testing

- **TEST-001**: `seedphrase.ts` — Generate 12-word mnemonic, validate it, re-derive from same entropy → same words (determinism)
- **TEST-002**: `hd-keys.ts` — Same seedphrase always derives identical keys for all `m/*` paths; different paths produce different keys
- **TEST-003**: `keypair.ts` — Sign arbitrary message, verify signature passes; modified message fails verification; X25519 ECDH produces identical shared secret on both sides
- **TEST-004**: `block-cipher.ts` — Encrypt plaintext, decrypt ciphertext → original plaintext; wrong key → decryption failure; CryptoKey `extractable === false`
- **TEST-005**: `chain.ts` — Build 5-block chain, walk passes; corrupt `prev_hash` of block 3, walk fails with tamper error at block 3
- **TEST-006**: `chain.ts` replay engine — Apply CREATE, UPDATE, DELETE ops; final state reflects last UPDATE; deleted credential absent from state
- **TEST-007**: `post-quantum.ts` — SPHINCS+ sign/verify roundtrip; ML-KEM encapsulate/decapsulate shared secret equality; keypair determinism from same seed
- **TEST-008**: `hybrid-sig.ts` — Valid bundle passes; corrupt Ed25519 signature → fails; corrupt SPHINCS+ signature → fails; both must pass for valid result
- **TEST-009**: `pq-anchor.ts` — 50 blocks → 1 anchor; anchor hash matches recomputed Merkle root; modified block changes Merkle root
- **TEST-010**: `sss.ts` — Split 24-word seedphrase into 5 shares (3-of-5); reconstruct with any 3 shares → original seedphrase; only 2 shares → failure
- **TEST-011**: `sharing.ts` — Alice encrypts credential for Bob (X25519 v1); Bob decrypts → original credential; ML-KEM v2 roundtrip; v1/v2 backward compat
- **TEST-012**: API `POST /api/blocks/append` — Valid block appended; wrong signature rejected 401; wrong `prev_hash` rejected 409; frozen vault rejected 403
- **TEST-013**: Emergency Kill Switch — After trigger: all device requests return 403; vault `status = frozen`; all `vault_sessions.revoked_at` set; re-open with seedphrase unfreezes vault

---

## 7. Risks & Assumptions

- **RISK-001**: `@noble/post-quantum` is beta — API may change before Phase PQ-2; mitigate by wrapping in `post-quantum.ts` adapter layer so internal callers are isolated from upstream API changes.
- **RISK-002**: SPHINCS+ signing at ~6 ops/sec in WASM may block vault operations if not offloaded — mitigate with Web Worker for all SPHINCS+ signing operations.
- **RISK-003**: Long credential chains (1,000+ blocks) may cause slow chain replay on cold start — mitigate with periodic IndexedDB snapshots; replay only blocks newer than last verified snapshot.
- **RISK-004**: Seedphrase loss = permanent vault lockout — mitigate with mandatory onboarding backup confirmation (3 random word challenge) and Shamir's Secret Sharing (F4).
- **RISK-005**: WebAuthn is not universally available — Argon2id PIN fallback must be fully functional and tested independently.
- **RISK-006**: ML-KEM vault sharing (v2) is a breaking change from X25519 (v1) — mitigate with explicit protocol versioning; v1 packets must remain decryptable indefinitely.
- **RISK-007**: Canary block false positives (e.g., breached external service, not vault compromise) may cause user panic — alert messaging must clearly communicate to investigate before assuming vault breach.
- **RISK-008**: T5 threat (vault open + device stolen) cannot be fully mitigated cryptographically — aggressive auto-lock (2 min default) and remote emergency lock are the best available countermeasures.
- **ASSUMPTION-001**: The app runs in a modern browser with Web Crypto API, WebAuthn API, and IndexedDB support (Chrome 90+, Firefox 90+, Safari 15+).
- **ASSUMPTION-002**: Supabase RLS correctly enforces per-user chain isolation — server-side signature verification provides an additional independent defense layer.
- **ASSUMPTION-003**: `@noble/post-quantum` will reach stable release before Phase PQ-2 implementation begins.
- **ASSUMPTION-004**: Per-category key isolation (F6, `m/cat/N`) uses the category's integer index as `N` — category indices are stable and not reused after deletion.

---

## 8. Related Specifications / Further Reading

- [docs/BLOCKCHAIN-REFACTOR.md](../docs/BLOCKCHAIN-REFACTOR.md) — Source architectural concept document
- [docs/rate-limiting.md](../docs/rate-limiting.md) — Rate limiting strategy for API endpoints
- [PRD.md](../PRD.md) — Full product requirements
- [BIP-39 Mnemonic Code](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) — Seedphrase standard
- [BIP-32 HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) — Hierarchical Deterministic key derivation
- [FIPS 205 (SLH-DSA / SPHINCS+)](https://csrc.nist.gov/pubs/fips/205/final) — NIST post-quantum signature standard
- [FIPS 203 (ML-KEM / Kyber)](https://csrc.nist.gov/pubs/fips/203/final) — NIST post-quantum key encapsulation standard
- [Web Crypto API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — Browser-native AES-256-GCM
- [WebAuthn Level 2 — W3C](https://www.w3.org/TR/webauthn-2/) — Secure Enclave key binding
- [Shamir's Secret Sharing — Wikipedia](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing) — Seedphrase backup splitting

# Blockchain Password Store Refactor

> **Tipe Dokumen**: Architectural Concept & Refactoring Proposal
> **Status**: Draft
> **Branch**: `claude/blockchain-password-refactor-8uV1s`

---

## Ringkasan Ide

Password store yang ada saat ini menyimpan credential sebagai record biasa di database (Supabase/PostgreSQL). Refactoring ini mengubah model penyimpanan itu menjadi **credential chain** — sebuah struktur yang terinspirasi dari blockchain dimana setiap entri credential adalah sebuah "block" yang terhubung secara kriptografis dengan block sebelumnya.

Akses ke seluruh vault tidak lagi bergantung pada email magic link semata, melainkan dikontrol oleh sebuah **seedphrase** (12 atau 24 kata BIP-39) yang menjadi satu-satunya sumber kebenaran untuk derivasi kunci enkripsi.

---

## Masalah yang Diselesaikan

| Masalah Sebelumnya | Solusi dengan Refactor Ini |
|---|---|
| Credential tersimpan sebagai row independen, tidak ada jaminan integritas historis | Setiap perubahan menghasilkan block baru; chain tidak bisa dimanipulasi diam-diam |
| Recovery bergantung pada akses email (magic link) | Recovery cukup dengan 12/24 kata seedphrase, device-agnostic |
| Tidak ada riwayat perubahan credential | Setiap edit menghasilkan block baru; riwayat lengkap tersimpan on-chain |
| Enkripsi flat (satu kunci untuk semua) | HD key derivation: setiap kategori/vault punya kunci turunan unik |
| Tidak ada deteksi tamper dari sisi server | Chain integrity check mendeteksi modifikasi yang tidak sah |

---

## Konsep Inti

### 1. Credential Block Structure

Setiap credential entry direpresentasikan sebagai sebuah block:

```
┌─────────────────────────────────────────────────┐
│                   BLOCK N                        │
├─────────────────────────────────────────────────┤
│  block_index     : number                        │
│  timestamp       : ISO 8601                      │
│  prev_hash       : SHA-256(Block N-1)            │
│  nonce           : random bytes (16)             │
│  payload         : AES-256-GCM(credential_data) │
│  block_hash      : SHA-256(semua field di atas)  │
└─────────────────────────────────────────────────┘
```

**Genesis Block** (Block 0) adalah block khusus yang menyimpan metadata vault (dibuat saat vault pertama kali diinisialisasi) dengan `prev_hash = "0000...0000"`.

**Payload** yang dienkripsi berisi:
```json
{
  "id": "uuid",
  "type": "login | card | note | totp",
  "title": "GitHub",
  "username": "user@email.com",
  "password": "s3cr3t",
  "url": "https://github.com",
  "totp_secret": "BASE32SECRET",
  "tags": ["dev", "work"],
  "op": "CREATE | UPDATE | DELETE"
}
```

Field `op` penting: sebuah credential tidak pernah "dihapus" secara fisik. Penghapusan adalah block baru dengan `op: "DELETE"`. Ini menjaga audit trail tetap utuh.

---

### 2. Seedphrase sebagai Master Key

Menggantikan konsep "master password", vault manager menggunakan **BIP-39 mnemonic** (12 atau 24 kata) sebagai sumber kunci utama.

```
Seedphrase (12/24 kata)
        │
        ▼ PBKDF2 / Argon2id (high iterations)
        │
   Master Seed (512-bit entropy)
        │
        ├─── m/vault/0  ──▶  Vault Encryption Key (AES-256)
        ├─── m/vault/1  ──▶  Backup/Recovery Key
        ├─── m/hmac/0   ──▶  Block HMAC Signing Key
        └─── m/cat/N    ──▶  Per-Category Derived Key (N = category index)
```

Derivasi mengikuti pola **BIP-32 Hierarchical Deterministic (HD)** yang dimodifikasi untuk non-blockchain environment:
- Kunci tidak pernah meninggalkan device pengguna (zero-knowledge tetap terjaga)
- Server hanya menyimpan encrypted blocks — tidak pernah tahu kuncinya
- Seedphrase yang sama selalu menghasilkan kunci yang sama (deterministik)

---

### 3. Chain Integrity Verification

Saat vault dibuka, client melakukan **chain walk**:

```
[Block 0] ──hash──▶ [Block 1] ──hash──▶ [Block 2] ──hash──▶ ... ──hash──▶ [Block N]
    │                    │                    │                                  │
 Verify                Verify               Verify                           Verify
 genesis             prev_hash            prev_hash                          HEAD
```

Jika ada block di tengah yang hash-nya tidak cocok dengan `prev_hash` block berikutnya → **TAMPER DETECTED** → vault masuk ke read-only mode dan user diberi alert.

---

### 4. Vault State Reconstruction

Karena setiap operasi (CREATE/UPDATE/DELETE) menghasilkan block baru, **state vault saat ini** adalah hasil dari "replay" seluruh chain:

```
chain = [B0, B1, B2, B3, B4, B5]
ops   = [genesis, CREATE(gh), CREATE(fb), UPDATE(gh), DELETE(fb), CREATE(aws)]

current_state = {
  "gh":  data dari B3 (UPDATE terakhir),
  "aws": data dari B5 (CREATE)
}
```

Proses ini dilakukan di client setelah decrypt semua blocks. Server tidak pernah tahu isi state.

---

## Fitur Baru yang Diaktifkan

### F1 — Seedphrase Recovery
**Tanpa seedphrase, vault tidak bisa dibuka.** Magic link sekarang hanya sebagai identitas akun, bukan kunci vault. Dengan seedphrase, user bisa:
- Login dari device baru tanpa setup ulang
- Export vault sebagai encrypted snapshot
- Import vault di device lain dengan seedphrase + snapshot

**UI Flow:**
```
[Daftar] → Generate seedphrase → Tampilkan 12/24 kata → Konfirmasi backup → Vault aktif
[Login]  → Magic link (verifikasi identitas) → Input seedphrase → Vault terbuka
```

---

### F2 — Tamper-Evident Audit Log
Setiap block yang berhasil di-verify bisa ditampilkan sebagai **audit trail** di UI:

```
Timeline:
  ● 2026-03-29 14:32 — Created "GitHub"
  ● 2026-03-29 15:01 — Updated "GitHub" (password changed)
  ● 2026-03-30 09:15 — Created "AWS Console"
  ● 2026-04-01 11:00 — Deleted "Facebook"
  ✗ 2026-04-02 ??:?? — TAMPER DETECTED on Block #7
```

---

### F3 — Credential Version History
Karena UPDATE tidak menimpa block lama, user bisa melihat riwayat nilai credential:

```
GitHub › Password History:
  [Current]  ••••••••   diset 2026-03-29 15:01
  [v1]       ••••••••   diset 2026-03-29 14:32   [Restore]
```

Setiap versi lama bisa di-restore dengan membuat block UPDATE baru yang berisi nilai lama tersebut.

---

### F4 — Shamir's Secret Sharing (SSS) untuk Seedphrase
Untuk user yang khawatir kehilangan seedphrase, implementasikan **Shamir's Secret Sharing**:

```
Seedphrase (24 kata)
        │
        ▼  SSS split (3-of-5)
        │
  Share A  Share B  Share C  Share D  Share E
  (simpan) (email)  (trusted) (print) (cloud)
```

Minimal 3 dari 5 share diperlukan untuk merekonstruksi seedphrase. User mendistribusikan shares ke lokasi berbeda untuk redundansi.

---

### F5 — Vault Snapshot & Portability
User bisa mengekspor seluruh chain sebagai file terenkripsi:

```json
{
  "vault_id": "uuid",
  "schema_version": "1.0",
  "chain_length": 42,
  "exported_at": "2026-03-29T14:00:00Z",
  "blocks": [...],  // encrypted, hanya bisa dibuka dengan seedphrase
  "chain_root_hash": "sha256..."
}
```

Import di device baru: upload snapshot + input seedphrase → vault terbuka.

---

### F6 — Per-Category Isolated Keys
Setiap kategori (Personal, Work, Finance) menggunakan kunci turunan yang berbeda:

```
m/cat/0  → Personal vault key
m/cat/1  → Work vault key
m/cat/2  → Finance vault key
```

Manfaat: jika satu derived key pernah terekspos, kategori lain tetap aman. User juga bisa berbagi satu kategori dengan orang lain tanpa mengekspos kategori lainnya (shared derived key).

---

### F7 — Offline-First dengan Sync Conflict Resolution
Chain yang deterministik memudahkan resolusi konflik saat sync:

```
Device A (offline):  ... Block 10 → Block 11 (CREATE gmail)
Device B (online):   ... Block 10 → Block 11 (CREATE twitter) → Block 12

Saat Device A online:
  → Rebase Block 11 Device A di atas Block 12 Device B
  → Hasil: ... → Block 12 (twitter) → Block 13 (gmail)
```

Mirip dengan git rebase — konflik diselesaikan secara deterministik berdasarkan timestamp.

---

## Perubahan Arsitektur

### Data Model (PostgreSQL)

**Sebelum (flat records):**
```sql
CREATE TABLE credentials (
  id UUID PRIMARY KEY,
  user_id UUID,
  title TEXT,
  username TEXT,
  password TEXT,  -- encrypted
  ...
);
```

**Sesudah (credential chain):**
```sql
CREATE TABLE vault_chains (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chain_blocks (
  id UUID PRIMARY KEY,
  chain_id UUID REFERENCES vault_chains(id),
  block_index BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  prev_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  payload TEXT NOT NULL,    -- AES-256-GCM encrypted JSON
  block_hash TEXT NOT NULL,
  UNIQUE(chain_id, block_index)
);

CREATE INDEX idx_blocks_chain_index ON chain_blocks(chain_id, block_index);
```

Server tidak bisa membaca `payload` — tetap zero-knowledge.

---

### Crypto Module Baru

```
src/lib/crypto/
  ├── seedphrase.ts      — BIP-39 generate, validate, entropy extraction
  ├── hd-keys.ts         — HD key derivation (BIP-32 inspired)
  ├── block-cipher.ts    — AES-256-GCM encrypt/decrypt per block
  ├── chain.ts           — Block creation, chain assembly, integrity verification
  ├── sss.ts             — Shamir's Secret Sharing split/combine
  └── index.ts           — Public API exports
```

---

### Client State Flow

```
App Start
    │
    ▼
Cek session (magic link auth)
    │
    ▼
Minta seedphrase (UI input)
    │
    ▼
Derive master key dari seedphrase
    │
    ▼
Fetch chain_blocks dari server
    │
    ▼
Verify chain integrity
    │
    ├── FAIL ──▶ Tampilkan tamper alert, read-only mode
    │
    └── PASS ──▶ Decrypt & replay blocks ──▶ Render vault state
```

---

## Implikasi UX

### Onboarding Baru
1. User daftar dengan email → verifikasi magic link
2. Sistem generate 12/24 seedphrase
3. User diwajibkan mencatat/backup seedphrase (UI enforcement: konfirmasi 3 kata acak)
4. Genesis block dibuat → vault siap

### Login Baru
1. User klik magic link di email
2. Setelah redirect: muncul modal input seedphrase
3. Vault terbuka (seedphrase tidak pernah dikirim ke server)

### Recovery
1. User kehilangan akses device
2. Minta magic link baru ke email
3. Input seedphrase → vault terbuka dari mana saja

---

## Batasan & Trade-offs

| Aspek | Catatan |
|---|---|
| **Performa chain replay** | Chain panjang (1000+ blocks) bisa lambat. Mitigasi: simpan **snapshot** (state terakhir yang diverifikasi) secara periodik di client (IndexedDB) dan hanya replay blocks baru sejak snapshot terakhir. |
| **Seedphrase hilang = vault hilang** | Ini by design (zero-knowledge), tapi perlu UX yang sangat jelas saat onboarding. SSS (F4) adalah mitigasi utama. |
| **Storage server bertambah** | UPDATE/DELETE tidak menimpa data lama. Vault dengan riwayat panjang akan menggunakan lebih banyak storage. Mitigasi: **chain compaction** (opsional, merges blocks ke snapshot terenkripsi). |
| **Kompleksitas implementasi** | Jauh lebih kompleks dari CRUD biasa. Perlu crypto module yang solid dan diuji secara ekstensif. |

---

## Fase Implementasi (Roadmap)

```
Phase 1 — Foundation (Core Crypto)
  ✦ Implementasi seedphrase generation (BIP-39)
  ✦ HD key derivation module
  ✦ Block structure & AES-256-GCM cipher
  ✦ Chain assembly & integrity verification
  ✦ Unit tests untuk semua crypto primitives

Phase 2 — Data Layer
  ✦ Migrasi schema PostgreSQL
  ✦ Supabase RLS update (chain_blocks per user)
  ✦ API endpoints: fetch blocks, append block
  ✦ Client-side chain replay engine

Phase 3 — Auth Flow Refactor
  ✦ Onboarding UI: seedphrase generation & confirmation
  ✦ Login UI: seedphrase input modal
  ✦ Recovery flow

Phase 4 — Advanced Features
  ✦ Version history UI (F3)
  ✦ Audit log UI (F2)
  ✦ Vault snapshot export/import (F5)
  ✦ Shamir's Secret Sharing UI (F4)
  ✦ Per-category key isolation (F6)
```

---

## Referensi Teknologi

- [BIP-39 Mnemonic Code](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) — Seedphrase standard
- [BIP-32 HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) — Hierarchical key derivation
- [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing) — Key splitting
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — Browser-native AES-256-GCM
- [Argon2id](https://www.rfc-editor.org/rfc/rfc9106) — Password hashing untuk key stretching
- [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) — Library BIP-39 yang audited
- [`@scure/bip32`](https://github.com/paulmillr/scure-bip32) — Library BIP-32 yang audited
- [`secrets.js-grempe`](https://github.com/grempe/secrets.js) — Shamir's Secret Sharing untuk JS

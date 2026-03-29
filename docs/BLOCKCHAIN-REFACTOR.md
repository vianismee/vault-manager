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
| Tidak ada autentikasi identitas pengirim block | Setiap block ditandatangani dengan private key; siapa pun bisa verifikasi dengan public key |
| Berbagi credential antar user tidak aman | Enkripsi dengan public key penerima — hanya penerima yang bisa dekripsi |
| Multi-device butuh seedphrase dikirim ulang | Device baru diotorisasi via keypair; seedphrase tidak perlu berpindah |

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
│  signature       : Ed25519Sign(block_hash, privKey) │
└─────────────────────────────────────────────────┘
```

Field `signature` ditambahkan: block ditandatangani dengan **private key** vault. Siapapun yang memiliki **public key** bisa memverifikasi bahwa block ini benar-benar dibuat oleh pemilik vault — tanpa perlu tahu isi payload.

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
        ├─── m/cat/N    ──▶  Per-Category Derived Key (N = category index)
        │
        └─── m/identity/0
                │
                ├── Private Key (Ed25519)  ──▶  block signing, dekripsi shared data
                └── Public Key  (Ed25519)  ──▶  vault identity, verifikasi, enkripsi untuk orang lain
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

### 5. Public Key & Private Key Layer

Selain kunci simetris untuk enkripsi payload, arsitektur ini menggunakan **kriptografi asimetris (Ed25519)** yang diturunkan dari path `m/identity/0` pada master seed.

#### Peran masing-masing kunci:

```
Private Key (Ed25519)
  ├── Menandatangani setiap block (signature field)
  ├── Mendekripsi data yang dienkripsi khusus untuk vault ini
  └── Mengesahkan otorisasi device baru

Public Key (Ed25519 → X25519 untuk enkripsi)
  ├── Memverifikasi signature block (siapapun bisa, tanpa private key)
  ├── Identitas unik vault (seperti "alamat" di blockchain)
  └── Digunakan orang lain untuk mengenkripsi data yang hanya bisa dibaca vault ini
```

#### Hubungan simetris vs asimetris:

```
┌─────────────────────────────────────────────────────────────┐
│                     OPERASI KRIPTOGRAFI                      │
├────────────────────┬────────────────────────────────────────┤
│  Enkripsi payload  │  AES-256-GCM (symmetric, derived key)  │
│  Tanda tangan block│  Ed25519 (private key)                  │
│  Verifikasi block  │  Ed25519 (public key)                   │
│  Berbagi credential│  X25519 ECDH + AES (public key penerima)│
│  Device auth       │  Ed25519 (device keypair + vault privkey)│
└────────────────────┴────────────────────────────────────────┘
```

#### Kenapa Ed25519 bukan secp256k1 (Bitcoin curve)?

Ed25519 dipilih karena:
- Signature lebih cepat dan lebih pendek (64 bytes vs 71 bytes DER)
- Tidak rentan terhadap nonce reuse attack (deterministik by design)
- Didukung natively di Web Crypto API (`sign/verify` dengan `Ed25519`)
- Konversi ke X25519 untuk ECDH (key exchange) sangat mudah — satu keypair bisa melayani keduanya

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

### F8 — Vault Sharing via Public Key

User bisa berbagi satu credential (atau satu kategori) ke user lain **tanpa mengekspos private key atau seedphrase**:

```
Alice ingin share credential "Netflix" ke Bob:

1. Alice ambil Public Key Bob (dari vault address Bob)
2. Alice generate ephemeral keypair (sekali pakai)
3. Alice lakukan ECDH: shared_secret = ECDH(Alice_ephemeral_privkey, Bob_pubkey)
4. Enkripsi credential dengan AES(shared_secret)
5. Kirim: { ephemeral_pubkey, encrypted_credential } ke Bob

Bob mendekripsi:
  shared_secret = ECDH(Bob_privkey, ephemeral_pubkey)
  credential    = AES_decrypt(shared_secret, encrypted_credential)
```

Bob tidak perlu tahu seedphrase Alice. Alice tidak perlu tahu private key Bob. Server tidak bisa membaca isinya.

---

### F9 — Multi-Device Authorization via Keypair

Menambahkan device baru **tidak memerlukan pengiriman ulang seedphrase**:

```
[Device Baru]                          [Device Lama / Trusted]
      │                                          │
      │ 1. Generate device keypair               │
      │    (device_privkey, device_pubkey)        │
      │                                          │
      │ 2. Kirim device_pubkey + request ────▶   │
      │                                          │ 3. Owner verifikasi (approve di UI)
      │                                          │ 4. Enkripsi vault_master_key dengan
      │                                          │    device_pubkey
      │ 5. Terima encrypted_vault_key    ◀────   │
      │                                          │
      │ 6. Dekripsi dengan device_privkey        │
      │ 7. Vault terbuka tanpa seedphrase        │
```

**Revoke device**: Owner menandatangani pesan revoke dengan private key → device yang direvoke tidak bisa lagi mengambil blocks baru dari server (server verifikasi signature revoke).

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

-- Public key vault (identitas, verifikasi signature)
CREATE TABLE vault_identities (
  chain_id   UUID PRIMARY KEY REFERENCES vault_chains(id),
  public_key TEXT NOT NULL  -- Ed25519 public key (hex/base64)
);

-- Device registry untuk multi-device auth (F9)
CREATE TABLE authorized_devices (
  id             UUID PRIMARY KEY,
  chain_id       UUID REFERENCES vault_chains(id),
  device_pubkey  TEXT NOT NULL,
  label          TEXT,          -- "iPhone 15", "MacBook Pro"
  authorized_at  TIMESTAMPTZ DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ,
  revoke_sig     TEXT           -- signature revoke dari vault private key
);
```

Server tidak bisa membaca `payload` — tetap zero-knowledge. `public_key` dan `device_pubkey` boleh publik — tidak mengekspos data credential.

---

### Crypto Module Baru

```
src/lib/crypto/
  ├── seedphrase.ts      — BIP-39 generate, validate, entropy extraction
  ├── hd-keys.ts         — HD key derivation (BIP-32 inspired)
  ├── keypair.ts         — Ed25519 keypair derivation, sign, verify; X25519 ECDH untuk sharing
  ├── block-cipher.ts    — AES-256-GCM encrypt/decrypt, non-extractable CryptoKey management
  ├── chain.ts           — Block creation, chain assembly, integrity + signature verification
  ├── secure-enclave.ts  — WebAuthn credential binding, key wrapping/unwrapping (Secure Enclave)
  ├── session-guard.ts   — Auto-lock timer, Page Visibility listener, memory scrubbing
  ├── sharing.ts         — Ephemeral ECDH credential sharing (F8)
  ├── device-auth.ts     — Device keypair, authorization, revoke & emergency kill (F9, F10)
  ├── canary.ts          — Canary block injection & monitoring (F11)
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

## Keamanan Device & Threat Model

### Threat Tier Matrix

Sebelum membahas mitigasi, penting untuk mendefinisikan **level ancaman** secara jelas:

```
┌──────┬──────────────────────────────────────────┬────────────────────────────────┐
│ Tier │ Skenario                                  │ Dampak Tanpa Mitigasi          │
├──────┼──────────────────────────────────────────┼────────────────────────────────┤
│  T1  │ Server Supabase diretas                   │ ✅ Aman — data encrypted,      │
│      │                                           │    server tidak tahu kuncinya  │
├──────┼──────────────────────────────────────────┼────────────────────────────────┤
│  T2  │ Device hilang/dicuri, layar terkunci      │ ⚠️  Tergantung kekuatan PIN    │
│      │                                           │    dan Secure Enclave          │
├──────┼──────────────────────────────────────────┼────────────────────────────────┤
│  T3  │ Device hilang/dicuri, layar tidak terkunci│ ⚠️  Vault aktif terekspos jika │
│      │ tapi vault sedang terkunci (auto-lock)    │    auto-lock belum berjalan    │
├──────┼──────────────────────────────────────────┼────────────────────────────────┤
│  T4  │ Remote backdoor / malware aktif           │ ❌  Keylogger, memory dump,    │
│      │                                           │    clipboard hijack            │
├──────┼──────────────────────────────────────────┼────────────────────────────────┤
│  T5  │ Device dicuri, vault terbuka,             │ ❌  Worst case — semua plaintext│
│      │ seedphrase tersimpan di device            │    credential terekspos        │
└──────┴──────────────────────────────────────────┴────────────────────────────────┘
```

Zero-knowledge architecture **hanya melindungi T1 secara native**. T2–T5 membutuhkan lapisan mitigasi di sisi client.

---

### Mitigasi T2 & T3 — Device Hilang / Dicuri

#### 1. Remote Device Revoke (Ekstensi F9)

Dari device lain yang masih dipercaya, owner mengirim signed revoke message:

```
[Device Terpercaya]
        │
        │ 1. Sign revoke payload:
        │    { device_id, revoked_at, reason } + Ed25519(vault_privkey)
        │
        ▼
   Server Supabase
        │
        │ 2. Verifikasi signature dengan vault public key
        │ 3. Set revoked_at pada authorized_devices
        │ 4. Tolak semua request dari device_pubkey tersebut
        │
        ▼
   [Device yang Dicuri] → 401 Unauthorized untuk semua fetch blocks
```

**Penting**: Karena private key tersimpan di Secure Enclave device yang dicuri, attacker **tidak bisa membuat signature baru** yang valid — tapi jika vault sudah terbuka saat pencurian, data yang sudah di-decrypt di memori tetap terekspos (T5).

#### 2. Secure Enclave / TPM Key Binding

Kunci vault tidak disimpan sebagai raw bytes di IndexedDB. Sebaliknya, kunci dibungkus (**key wrapping**) menggunakan kunci yang terikat ke hardware device:

```
Seedphrase → derive vault_key (AES-256)
                    │
                    ▼ wrap dengan device_bound_key
                    │
            wrapped_vault_key ──▶ disimpan di IndexedDB
                    │
           device_bound_key = WebAuthn credential key
                              (tinggal di Secure Enclave, tidak bisa di-export)
```

Saat vault dibuka di device yang sama:
```
WebAuthn authenticate (biometric/PIN) → release device_bound_key
    │
    ▼ unwrap
    │
vault_key (hanya tersedia di memori, non-exportable CryptoKey)
```

Efek: **mencuri file IndexedDB saja tidak cukup** — penyerang juga harus melewati biometrik / PIN device.

#### 3. Auto-Lock & Key Lifetime

```
Vault terbuka:
  CryptoKey objects hidup di memory (extractable: false)
  Raw bytes TIDAK pernah ada di JS variable

Trigger auto-lock (salah satu dari):
  • Inactivity timeout (default: 5 menit, configurable)
  • Tab/window minimized > threshold
  • Device screen lock event
  • User klik "Lock Vault"

Saat lock:
  CryptoKey references = null
  GC → keys hilang dari memory
  IndexedDB cache: wrapped_vault_key tetap ada, tapi tidak berguna tanpa biometrik
```

---

### Mitigasi T4 — Remote Backdoor / Malware

Ini threat yang paling kompleks karena attacker sudah **berada di dalam device**. Strategi pertahanan berlapis:

#### Layer 1 — Non-Extractable CryptoKey (Web Crypto API)

Ini perlindungan paling fundamental. Semua kunci kriptografi dibuat dengan flag `extractable: false`:

```typescript
// SALAH — key bisa dibaca dari JS:
const rawKey = new Uint8Array([...]);
// attacker bisa console.log(rawKey)

// BENAR — key tidak bisa dibaca dari JS:
const cryptoKey = await crypto.subtle.importKey(
  'raw',
  rawKeyBytes,
  { name: 'AES-GCM' },
  false,          // extractable: false ← kunci tidak bisa di-export/dibaca
  ['encrypt', 'decrypt']
);
rawKeyBytes.fill(0); // zero-out raw bytes setelah import
// cryptoKey.extractable === false
// tidak ada cara di JS untuk mendapatkan raw bytes kembali
```

Bahkan jika malware menginjeksi script dan mengakses `cryptoKey` object, `crypto.subtle.exportKey()` akan throw `DOMException: key is not extractable`.

#### Layer 2 — Content Security Policy (CSP)

Mencegah injeksi script dari luar (XSS, supply chain attack):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'sha256-<hash>';   ← hanya script dengan hash ini yang boleh jalan
  connect-src 'self' https://*.supabase.co;
  style-src 'self' 'unsafe-inline';
  object-src 'none';
  base-uri 'self';
```

#### Layer 3 — Subresource Integrity (SRI)

Setiap script eksternal harus memiliki hash yang diverifikasi browser:

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-<hash>"
  crossorigin="anonymous">
</script>
```

Jika CDN di-compromise dan script dimodifikasi → browser menolak menjalankannya.

#### Layer 4 — Seedphrase Input Protection

Seedphrase adalah titik paling rentan (single point of keylogging). Mitigasi:

```
Opsi 1 — Virtual Keyboard Acak:
  Tampilkan on-screen keyboard dengan layout tombol yang di-randomize setiap kali
  → keylogger fisik/software tidak bisa merekam posisi tombol yang sama

Opsi 2 — WebAuthn sebagai pengganti seedphrase (untuk re-open vault):
  Seedphrase hanya diinput SEKALI saat onboarding / recovery
  Setelahnya: biometrik / PIN device membuka wrapped_vault_key
  → seedphrase tidak pernah diketik lagi dalam penggunaan sehari-hari

Opsi 3 — Clipboard-free input:
  Field seedphrase tidak mengizinkan paste (preventDefault pada paste event)
  → malware clipboard sniffer tidak dapat intercept
```

#### Layer 5 — Memory Scrubbing

Setelah kunci digunakan, raw bytes di-zero-out secara eksplisit:

```typescript
// Setelah derive keys dari seedphrase:
seedphraseBytes.fill(0);     // zero-out seedphrase bytes
masterSeedBytes.fill(0);     // zero-out master seed
// Hanya CryptoKey objects (non-extractable) yang bertahan di memori
```

#### Layer 6 — Clipboard Auto-Clear

Password dan OTP yang di-copy ke clipboard otomatis dihapus:

```typescript
navigator.clipboard.writeText(password);
setTimeout(() => {
  navigator.clipboard.writeText(''); // clear setelah 30 detik
}, 30_000);
```

---

### Mitigasi T5 — Vault Terbuka, Device Dicuri

Ini skenario terburuk. Mitigasinya adalah **memperkecil jendela eksposur**:

1. **Aggressive auto-lock**: default 2 menit inactivity (bukan 5) untuk password manager
2. **Screen-aware locking**: gunakan Page Visibility API — vault langsung lock saat tab tidak aktif
3. **Panic button**: shortcut keyboard (misal `Ctrl+Shift+L`) yang langsung lock vault
4. **Remote emergency lock**: dari device lain, kirim signed "force-lock" event → server memblokir session JWT device tersebut

---

### F10 — Emergency Kill Switch (Remote Wipe)

Jika situasi sudah sangat buruk (device dicuri dan tidak bisa di-revoke tepat waktu):

```
[Device Terpercaya / Web Interface]
        │
        │ Owner kirim signed emergency command:
        │ { action: "EMERGENCY_WIPE", chain_id, timestamp }
        │ + Ed25519(vault_privkey)
        │
        ▼
   Server Supabase
        │
        ├── Verifikasi signature
        ├── Set vault status = FROZEN
        ├── Revoke SEMUA authorized_devices
        ├── Invalidate SEMUA active sessions (JWT blocklist)
        └── Kirim email notifikasi ke owner
        │
        ▼
   Semua device → 403 Forbidden

Untuk membuka kembali:
  Owner input seedphrase dari device baru → vault di-unfreeze
  (seedphrase = ultimate authority)
```

**Yang TIDAK dilakukan**: chain blocks TIDAK dihapus dari server. Data tetap aman dan ter-enkripsi — hanya akses yang diblokir. Owner dengan seedphrase selalu bisa recovery.

---

### F11 — Canary Block (Honeypot Tamper Detection)

Teknik dari dunia threat intelligence. Sisipkan "credential palsu" yang tidak pernah digunakan di dalam chain:

```
Block #3: CREATE credential "canary-aws-prod" (fake AWS key yang terlihat nyata)
          ← user tidak melihat ini di UI, disembunyikan dengan flag canary: true

Monitoring:
  Jika credential "canary-aws-prod" pernah digunakan di AWS (CloudTrail alert)
  → VAULT TELAH DIKOMPROMIS — attacker berhasil decrypt dan mencuri credential
  → Trigger emergency response otomatis
```

Canary block ter-enkripsi seperti block normal. Attacker tidak bisa membedakan mana yang asli dan mana yang canary sebelum mendekripsi. Setelah mendekripsi dan "mencoba" credential canary, alarm berbunyi.

---

### Updated Client State Flow (dengan Security Layers)

```
App Start
    │
    ▼
Cek session JWT (valid?)
    │
    ├── NO  ──▶ Magic link auth
    │
    └── YES
         │
         ▼
    Vault locked? ──▶ YES ──▶ WebAuthn biometric / PIN
         │                          │
         │                          ▼ unwrap vault key (Secure Enclave)
         │                          │
         └── NO (active session) ───┘
                    │
                    ▼
         Fetch chain_blocks dari server
                    │
                    ▼
         Verify chain integrity + Ed25519 signatures
                    │
                    ├── FAIL ──▶ Tamper alert, read-only mode, notifikasi email
                    │
                    └── PASS
                          │
                          ▼
                   Decrypt & replay blocks (non-extractable CryptoKey)
                          │
                          ▼
                   Render vault state
                          │
                          ▼
                   Start auto-lock timer + Page Visibility listener
```

---

### Updated Schema (Security Tables)

```sql
-- Freeze/emergency state
ALTER TABLE vault_chains ADD COLUMN
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen'));

-- Session tracking untuk remote kill
CREATE TABLE vault_sessions (
  id           UUID PRIMARY KEY,
  chain_id     UUID REFERENCES vault_chains(id),
  device_id    UUID REFERENCES authorized_devices(id),
  jwt_jti      TEXT UNIQUE NOT NULL,  -- JWT ID untuk blocklist
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ            -- null = masih aktif
);

-- Canary credential registry (server-side, tidak di-sync ke client biasa)
CREATE TABLE canary_blocks (
  id           UUID PRIMARY KEY,
  chain_id     UUID REFERENCES vault_chains(id),
  block_index  BIGINT NOT NULL,
  alert_email  TEXT NOT NULL,
  triggered_at TIMESTAMPTZ            -- null = belum terpicu
);
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
| **Key rotation** | Jika private key terekspos, semua signature lama tetap valid. Mitigasi: buat keypair baru, tandatangani ulang HEAD block sebagai "key rotation event", invalidasi keypair lama di server. |
| **Public key discovery** | Untuk F8 (vault sharing), user perlu tahu public key penerima. Perlu mekanisme directory sederhana (user share vault address mereka secara manual). |
| **WebAuthn browser support** | Secure Enclave via WebAuthn membutuhkan browser modern + hardware yang support (TouchID, Windows Hello, YubiKey). Fallback: PIN-based key wrapping dengan Argon2id. |
| **Canary false positives** | Credential canary yang "bocor" bisa terjadi karena breach di sisi layanan target (misal AWS breach), bukan karena vault dikompromis. Investigasi manual tetap diperlukan. |
| **T5 tidak bisa di-mitigasi sepenuhnya** | Jika vault aktif dan device dicuri secara fisik, data yang sudah di-decrypt di memori tidak bisa diselamatkan. Auto-lock agresif adalah mitigasi terbaik yang mungkin. |

---

## Fase Implementasi (Roadmap)

```
Phase 1 — Foundation (Core Crypto)
  ✦ Implementasi seedphrase generation (BIP-39)
  ✦ HD key derivation module
  ✦ Ed25519 keypair derivation dari m/identity/0
  ✦ Block structure & AES-256-GCM cipher
  ✦ Block signing (Ed25519) & signature verification
  ✦ Chain assembly & integrity + signature verification
  ✦ Unit tests untuk semua crypto primitives

Phase 2 — Data Layer
  ✦ Migrasi schema PostgreSQL
  ✦ Supabase RLS update (chain_blocks per user)
  ✦ API endpoints: fetch blocks, append block
  ✦ Client-side chain replay engine

Phase 3 — Auth Flow & Device Security
  ✦ Onboarding UI: seedphrase generation & confirmation
  ✦ Login UI: WebAuthn biometric / PIN (seedphrase hanya untuk recovery)
  ✦ Secure Enclave key wrapping via WebAuthn
  ✦ Auto-lock timer + Page Visibility API
  ✦ Remote device revoke UI
  ✦ Emergency Kill Switch UI (F10)
  ✦ Canary block setup & monitoring (F11)
  ✦ CSP headers + SRI implementation

Phase 4 — Advanced Features
  ✦ Version history UI (F3)
  ✦ Audit log UI (F2)
  ✦ Vault snapshot export/import (F5)
  ✦ Shamir's Secret Sharing UI (F4)
  ✦ Per-category key isolation (F6)

Phase 5 — Keypair & Social Features
  ✦ Vault identity page (tampilkan public key / vault address)
  ✦ Credential sharing via public key (F8) — UI + ECDH flow
  ✦ Multi-device authorization UI (F9) — QR code pairing
  ✦ Device revoke UI dengan signature
  ✦ Receive shared credential inbox
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
- [`@noble/curves`](https://github.com/paulmillr/noble-curves) — Ed25519 & X25519 yang audited, zero-dependency
- [Ed25519 RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) — EdDSA signature standard
- [X25519 / ECDH RFC 7748](https://www.rfc-editor.org/rfc/rfc7748) — Elliptic curve Diffie-Hellman untuk key exchange
- [WebAuthn / FIDO2 Spec](https://www.w3.org/TR/webauthn-3/) — Secure Enclave key binding via browser
- [SubtleCrypto.importKey()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey) — Non-extractable CryptoKey API
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) — Trigger auto-lock saat tab tidak aktif
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/) — XSS & script injection prevention

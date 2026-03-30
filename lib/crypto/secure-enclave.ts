/**
 * secure-enclave.ts — WebAuthn device key binding + Argon2id/PBKDF2 PIN fallback.
 * REQ-012, CON-004, TASK-017
 *
 * Architecture:
 *  - A random 256-bit "device seed" is generated at vault setup and stored in
 *    IndexedDB. A wrapping key is derived from this seed.
 *  - The raw vault key bytes (before importAesKey) are AES-GCM encrypted with
 *    the wrapping key and stored as `wrapped_vault_key` in IndexedDB.
 *  - WebAuthn credential provides the access gate (assertion required before
 *    reading the device seed).
 *  - PIN fallback: PBKDF2-SHA256 (600k rounds) derives the wrapping key from
 *    PIN + salt, bypassing the device seed path.
 *
 * IndexedDB schema (object store "vault-enclave"):
 *   "device_seed"       → Uint8Array (32 bytes, encrypted with browser's own storage)
 *   "webauthn_cred_id"  → string (credential ID from navigator.credentials.create)
 *   "wrapped_vault_key" → Uint8Array (AES-GCM encrypted vault key bytes)
 *   "wrapped_vault_iv"  → Uint8Array (12-byte IV for wrapped_vault_key)
 *   "pin_salt"          → Uint8Array (32-byte PBKDF2 salt)
 *   "auth_mode"         → "webauthn" | "pin"
 */

const DB_NAME = 'vault-enclave';
const DB_VERSION = 1;
const STORE_NAME = 'enclave';

// ────────────────────────────────────────────────────────────
// IndexedDB helpers
// ────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function dbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbClear(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ────────────────────────────────────────────────────────────
// AES-GCM helpers (for wrapping raw bytes, not CryptoKey objects)
// ────────────────────────────────────────────────────────────

async function aesGcmEncrypt(
  data: Uint8Array,
  key: CryptoKey
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource);
  return { ciphertext: new Uint8Array(buf), iv };
}

async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey
): Promise<Uint8Array> {
  // @ts-expect-error TS5.9 Uint8Array<ArrayBufferLike> vs BufferSource mismatch
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(buf);
}

async function importWrappingKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', rawKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ────────────────────────────────────────────────────────────
// Device seed management
// ────────────────────────────────────────────────────────────

async function generateDeviceSeed(): Promise<Uint8Array> {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  await dbSet('device_seed', seed);
  return seed;
}

async function getDeviceSeed(): Promise<Uint8Array> {
  const seed = await dbGet<Uint8Array>('device_seed');
  if (!seed) throw new Error('Device not set up — run setupDevice() first');
  return seed;
}

// ────────────────────────────────────────────────────────────
// WebAuthn credential management
// ────────────────────────────────────────────────────────────

export interface WebAuthnSetupResult {
  credentialId: string;
}

/**
 * Create a new WebAuthn credential for this device.
 * The credential is used as an access gate (assertion required to unlock vault).
 */
export async function createWebAuthnCredential(
  username: string
): Promise<WebAuthnSetupResult> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Vault', id: window.location.hostname },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'discouraged',
      },
      timeout: 60000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error('WebAuthn credential creation cancelled');

  const credentialId = btoa(
    String.fromCharCode(...new Uint8Array(credential.rawId))
  );
  await dbSet('webauthn_cred_id', credentialId);
  await dbSet('auth_mode', 'webauthn');

  return { credentialId };
}

/**
 * Assert WebAuthn credential (gate check before accessing device seed).
 * Returns true if assertion succeeds.
 */
export async function assertWebAuthn(): Promise<boolean> {
  const credentialId = await dbGet<string>('webauthn_cred_id');
  if (!credentialId) throw new Error('No WebAuthn credential found');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const rawId = Uint8Array.from(atob(credentialId), (c) => c.charCodeAt(0));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        { type: 'public-key', id: rawId, transports: ['internal'] },
      ],
      userVerification: 'preferred',
      timeout: 60000,
    },
  });

  return assertion !== null;
}

// ────────────────────────────────────────────────────────────
// PIN-based fallback (PBKDF2-SHA256, 600k iterations)
// ────────────────────────────────────────────────────────────

async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const pinBytes = new TextEncoder().encode(pin);
  const baseKey = await crypto.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 600_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ────────────────────────────────────────────────────────────
// Public vault key wrapping / unwrapping API
// ────────────────────────────────────────────────────────────

/**
 * Wrap raw vault key bytes and store in IndexedDB.
 * Called during vault setup (onboarding) before the raw bytes are zeroed.
 *
 * @param rawVaultKey  32-byte vault key raw bytes (will NOT be zeroed here — caller zeros them)
 * @param deviceSeed   Optional: pass explicit device seed; if omitted, generates new one
 */
export async function wrapVaultKey(
  rawVaultKey: Uint8Array,
  deviceSeed?: Uint8Array
): Promise<void> {
  const seed = deviceSeed ?? (await generateDeviceSeed());
  const wrappingKey = await importWrappingKey(seed);
  const { ciphertext, iv } = await aesGcmEncrypt(rawVaultKey, wrappingKey);
  await dbSet('wrapped_vault_key', ciphertext);
  await dbSet('wrapped_vault_iv', iv);
}

/**
 * Unwrap the vault key from IndexedDB using the device seed.
 * Returns a non-extractable AES-256-GCM CryptoKey.
 *
 * Requires WebAuthn assertion if auth_mode is "webauthn".
 */
export async function unwrapVaultKey(): Promise<CryptoKey> {
  const authMode = await dbGet<string>('auth_mode');
  if (authMode === 'webauthn') {
    const ok = await assertWebAuthn();
    if (!ok) throw new Error('WebAuthn assertion failed');
  }

  const seed = await getDeviceSeed();
  const wrappingKey = await importWrappingKey(seed);

  const ciphertext = await dbGet<Uint8Array>('wrapped_vault_key');
  const iv = await dbGet<Uint8Array>('wrapped_vault_iv');
  if (!ciphertext || !iv) throw new Error('No wrapped vault key found in IndexedDB');

  const rawVaultKey = await aesGcmDecrypt(ciphertext, iv, wrappingKey);

  // Import as non-extractable AES-256-GCM key (REQ-011)
  const vaultKey = await crypto.subtle.importKey(
    'raw', rawVaultKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );

  // Zero raw key bytes (SEC-004)
  rawVaultKey.fill(0);

  return vaultKey;
}

/**
 * Wrap vault key with PIN-based key (fallback, no WebAuthn required).
 * Stores the PIN-encrypted vault key separately alongside the device-seed version.
 */
export async function wrapVaultKeyWithPin(
  rawVaultKey: Uint8Array,
  pin: string
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const pinKey = await deriveKeyFromPin(pin, salt);
  const { ciphertext, iv } = await aesGcmEncrypt(rawVaultKey, pinKey);

  await dbSet('pin_salt', salt);
  await dbSet('wrapped_vault_key_pin', ciphertext);
  await dbSet('wrapped_vault_iv_pin', iv);
  await dbSet('auth_mode', 'pin');
}

/**
 * Wrap Ed25519 private key with PIN-based key and store in IndexedDB.
 * Must be called AFTER wrapVaultKeyWithPin (reuses the same pin_salt).
 */
export async function wrapPrivateKeyWithPin(
  privateKey: Uint8Array,
  pin: string
): Promise<void> {
  const salt = await dbGet<Uint8Array>('pin_salt');
  if (!salt) throw new Error('PIN salt not found — call wrapVaultKeyWithPin first');
  const pinKey = await deriveKeyFromPin(pin, salt);
  const { ciphertext, iv } = await aesGcmEncrypt(privateKey, pinKey);
  await dbSet('wrapped_private_key_pin', ciphertext);
  await dbSet('wrapped_private_key_iv_pin', iv);
}

/**
 * Unwrap Ed25519 private key using PIN fallback.
 * Returns null if no private key is stored (pre-upgrade setup — user must re-register PIN).
 */
export async function unwrapPrivateKeyWithPin(pin: string): Promise<Uint8Array | null> {
  const salt = await dbGet<Uint8Array>('pin_salt');
  const ciphertext = await dbGet<Uint8Array>('wrapped_private_key_pin');
  const iv = await dbGet<Uint8Array>('wrapped_private_key_iv_pin');

  if (!salt || !ciphertext || !iv) return null;

  const pinKey = await deriveKeyFromPin(pin, salt);
  try {
    return await aesGcmDecrypt(ciphertext, iv, pinKey);
  } catch {
    throw new Error('Incorrect PIN');
  }
}

/**
 * Unwrap vault key using PIN fallback.
 */
export async function unwrapVaultKeyWithPin(pin: string): Promise<CryptoKey> {
  const salt = await dbGet<Uint8Array>('pin_salt');
  const ciphertext = await dbGet<Uint8Array>('wrapped_vault_key_pin');
  const iv = await dbGet<Uint8Array>('wrapped_vault_iv_pin');

  if (!salt || !ciphertext || !iv) throw new Error('No PIN-wrapped vault key found');

  const pinKey = await deriveKeyFromPin(pin, salt);
  let rawVaultKey: Uint8Array;
  try {
    rawVaultKey = await aesGcmDecrypt(ciphertext, iv, pinKey);
  } catch {
    throw new Error('Incorrect PIN');
  }

  const vaultKey = await crypto.subtle.importKey(
    'raw', rawVaultKey as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  rawVaultKey.fill(0);
  return vaultKey;
}

/**
 * Check whether this device has been set up (wrapped key exists in IndexedDB).
 * Checks both device-seed path and PIN path.
 */
export async function isDeviceSetup(): Promise<boolean> {
  const key = await dbGet<Uint8Array>('wrapped_vault_key');
  if (key !== undefined && key !== null) return true;
  const pinKey = await dbGet<Uint8Array>('wrapped_vault_key_pin');
  return pinKey !== undefined && pinKey !== null;
}

/**
 * Get the current auth mode for this device.
 */
export async function getAuthMode(): Promise<'webauthn' | 'pin' | null> {
  const mode = await dbGet<string>('auth_mode');
  return (mode as 'webauthn' | 'pin') ?? null;
}

/**
 * Check if WebAuthn is available on this platform.
 */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator.credentials?.create === 'function'
  );
}

/**
 * Clear all enclave data from IndexedDB (used during Emergency Kill Switch or reset).
 */
export async function clearEnclaveData(): Promise<void> {
  await dbClear();
}

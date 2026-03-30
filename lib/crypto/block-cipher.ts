/**
 * block-cipher.ts — AES-256-GCM encrypt/decrypt using Web Crypto API.
 * REQ-001, REQ-011, PAT-001, SEC-004
 *
 * All CryptoKey objects are created with extractable: false.
 * Raw key bytes are zero-filled immediately after importKey.
 */

const AES_ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

/**
 * Import a 32-byte raw key as a non-extractable AES-256-GCM CryptoKey.
 * The rawKey array is zero-filled after import (SEC-004).
 */
export async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.length !== 32) throw new Error('AES-256 key must be 32 bytes');

  const key = await crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: AES_ALGORITHM, length: 256 },
    false, // extractable: false (REQ-011, PAT-001)
    ['encrypt', 'decrypt']
  );

  // Zero-fill raw bytes immediately after importKey (SEC-004)
  rawKey.fill(0);

  return key;
}

/**
 * Encrypt plaintext bytes with AES-256-GCM.
 * Returns a Uint8Array of [iv (12 bytes) | ciphertext | auth tag (16 bytes)].
 */
export async function encryptAesGcm(
  key: CryptoKey,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    key,
    plaintext as BufferSource
  );

  // Prepend IV to ciphertext for storage
  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_LENGTH);

  return result;
}

/**
 * Decrypt AES-256-GCM ciphertext (format: iv || ciphertext || tag).
 * Returns plaintext bytes.
 */
export async function decryptAesGcm(
  key: CryptoKey,
  encryptedData: Uint8Array
): Promise<Uint8Array> {
  if (encryptedData.length < IV_LENGTH) {
    throw new Error('Encrypted data too short');
  }

  const iv = encryptedData.slice(0, IV_LENGTH);
  const ciphertext = encryptedData.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv },
    key,
    ciphertext
  );

  return new Uint8Array(plaintext);
}

/**
 * Encrypt a JSON-serializable payload and return a base64 string.
 */
export async function encryptPayload(key: CryptoKey, payload: object): Promise<string> {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const encrypted = await encryptAesGcm(key, bytes);
  return btoa(String.fromCharCode(...encrypted));
}

/**
 * Decrypt a base64 encrypted payload and return the parsed object.
 */
export async function decryptPayload<T = unknown>(
  key: CryptoKey,
  encryptedBase64: string
): Promise<T> {
  const bytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const plaintext = await decryptAesGcm(key, bytes);
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as T;
}

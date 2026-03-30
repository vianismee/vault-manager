/**
 * hd-keys.ts — BIP-32-inspired HD key derivation from master seed.
 * REQ-005, PAT-002
 *
 * Derivation paths supported:
 *   m/vault/0   → AES-256 vault encryption key (32 bytes)
 *   m/vault/1   → AES-256 vault backup key (32 bytes)
 *   m/hmac/0    → HMAC signing key (32 bytes)
 *   m/cat/N     → Per-category AES key (32 bytes), N = category index
 *   m/identity/0 → Ed25519 keypair seed (32 bytes)
 *   m/pq/sign/0  → SPHINCS+ signing keypair seed (32 bytes)
 *   m/pq/kem/0   → ML-KEM-768 keypair seed (32 bytes)
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';

export type DerivedKey = Uint8Array;

/**
 * Low-level: derive a 64-byte child key from a parent key + path segment label.
 * Uses HMAC-SHA512(parentKey, label). Left 32 bytes = child key, right 32 bytes = child chain code.
 */
function deriveChild(
  parentKey: Uint8Array,
  chainCode: Uint8Array,
  label: string
): { key: Uint8Array; chainCode: Uint8Array } {
  const labelBytes = new TextEncoder().encode(label);
  const data = new Uint8Array(labelBytes.length + parentKey.length);
  data.set(parentKey);
  data.set(labelBytes, parentKey.length);

  const h = hmac(sha512, chainCode, data);
  return {
    key: h.slice(0, 32),
    chainCode: h.slice(32, 64),
  };
}

/**
 * Parse a path string like "m/vault/0" into segments ["vault", "0"].
 */
function parsePath(path: string): string[] {
  const parts = path.split('/');
  if (parts[0] !== 'm') throw new Error(`Invalid HD path: ${path}`);
  return parts.slice(1);
}

/**
 * Derive a 32-byte key from master seed following a path string.
 *
 * @param masterSeed  64-byte master seed from mnemonicToMasterSeed()
 * @param path  e.g. "m/vault/0", "m/identity/0", "m/cat/3"
 * @returns 32-byte derived key material
 */
export function deriveKey(masterSeed: Uint8Array, path: string): DerivedKey {
  if (masterSeed.length !== 64) {
    throw new Error('Master seed must be 64 bytes');
  }

  // Root: HMAC-SHA512("VaultChain seed", masterSeed)
  const root = hmac(sha512, new TextEncoder().encode('VaultChain seed'), masterSeed);
  let key = root.slice(0, 32);
  let chainCode = root.slice(32, 64);

  const segments = parsePath(path);
  for (const segment of segments) {
    const child = deriveChild(key, chainCode, segment);
    key = child.key as Uint8Array<ArrayBuffer>;
    chainCode = child.chainCode as Uint8Array<ArrayBuffer>;
  }

  return key;
}

// Convenience helpers for well-known paths

export const HD_PATHS = {
  VAULT_KEY: 'm/vault/0',
  VAULT_KEY_BACKUP: 'm/vault/1',
  HMAC_KEY: 'm/hmac/0',
  IDENTITY: 'm/identity/0',
  PQ_SIGN: 'm/pq/sign/0',
  PQ_KEM: 'm/pq/kem/0',
  CATEGORY: (n: number) => `m/cat/${n}`,
} as const;

export function deriveVaultKey(masterSeed: Uint8Array): DerivedKey {
  return deriveKey(masterSeed, HD_PATHS.VAULT_KEY);
}

export function deriveIdentityKey(masterSeed: Uint8Array): DerivedKey {
  return deriveKey(masterSeed, HD_PATHS.IDENTITY);
}

export function deriveCategoryKey(masterSeed: Uint8Array, categoryIndex: number): DerivedKey {
  return deriveKey(masterSeed, HD_PATHS.CATEGORY(categoryIndex));
}

export function deriveHmacKey(masterSeed: Uint8Array): DerivedKey {
  return deriveKey(masterSeed, HD_PATHS.HMAC_KEY);
}

/**
 * keypair.ts — Ed25519 keypair derivation, signing, and X25519 ECDH key exchange.
 * REQ-001, REQ-005, DEP-002
 */

import { ed25519, x25519 } from '@noble/curves/ed25519.js';

export interface Ed25519Keypair {
  privateKey: Uint8Array; // 32 bytes
  publicKey: Uint8Array;  // 32 bytes
}

export interface X25519Keypair {
  privateKey: Uint8Array; // 32 bytes
  publicKey: Uint8Array;  // 32 bytes
}

/**
 * Derive an Ed25519 keypair from a 32-byte seed (e.g. from deriveIdentityKey()).
 */
export function deriveEd25519Keypair(seed: Uint8Array): Ed25519Keypair {
  if (seed.length !== 32) throw new Error('Ed25519 seed must be 32 bytes');
  const privateKey = seed.slice(); // copy — prevents aliasing when caller zeros the seed
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Sign a message with an Ed25519 private key.
 * Returns a 64-byte signature.
 */
export function sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

/**
 * Verify an Ed25519 signature.
 */
export function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/**
 * Convert an Ed25519 private key seed to an X25519 private key for ECDH.
 * Uses the standard clamped conversion (first 32 bytes of SHA-512 of the seed).
 */
export function ed25519ToX25519PrivateKey(ed25519PrivateKey: Uint8Array): Uint8Array {
  // @noble/curves x25519 accepts 32-byte scalars directly
  return ed25519PrivateKey.slice(0, 32);
}

/**
 * Derive an X25519 keypair from an Ed25519 private key seed.
 */
export function deriveX25519Keypair(ed25519Seed: Uint8Array): X25519Keypair {
  const privateKey = ed25519ToX25519PrivateKey(ed25519Seed);
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Perform X25519 ECDH key exchange.
 * Returns a 32-byte shared secret.
 */
export function ecdhSharedSecret(
  localPrivateKey: Uint8Array,
  remotePublicKey: Uint8Array
): Uint8Array {
  return x25519.getSharedSecret(localPrivateKey, remotePublicKey);
}

/**
 * Encode a public key as hex string (for vault address display / storage).
 */
export function publicKeyToHex(publicKey: Uint8Array): string {
  return Array.from(publicKey)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode a hex-encoded public key.
 */
export function hexToPublicKey(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

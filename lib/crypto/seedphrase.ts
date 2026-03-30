/**
 * seedphrase.ts — BIP-39 mnemonic generation, validation, and master seed extraction.
 * REQ-004, REQ-015, SEC-003, SEC-004
 */

import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';

export type WordCount = 12 | 24;

/**
 * Generate a new BIP-39 mnemonic.
 * 12 words = 128-bit entropy, 24 words = 256-bit entropy.
 */
export function generateMnemonic(wordCount: WordCount = 24): string {
  const strength = wordCount === 24 ? 256 : 128;
  return bip39.generateMnemonic(wordlist, strength);
}

/**
 * Validate a BIP-39 mnemonic (checksum + wordlist check).
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic, wordlist);
}

/**
 * Convert a validated mnemonic to a 512-bit master seed using BIP-39 PBKDF2.
 * The raw seed bytes must be zero-filled by the caller after key derivation (SEC-004).
 *
 * @param mnemonic  Validated BIP-39 mnemonic phrase
 * @param passphrase  Optional BIP-39 passphrase (default: empty string)
 * @returns  64-byte (512-bit) Uint8Array master seed
 */
export async function mnemonicToMasterSeed(
  mnemonic: string,
  passphrase = ''
): Promise<Uint8Array> {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid BIP-39 mnemonic');
  }
  // BIP-39 standard: PBKDF2-HMAC-SHA512, 2048 rounds, salt = "mnemonic" + passphrase
  const mnemonicBytes = new TextEncoder().encode(mnemonic.normalize('NFKD'));
  const saltBytes = new TextEncoder().encode(('mnemonic' + passphrase).normalize('NFKD'));

  const seed = await pbkdf2Async(sha512, mnemonicBytes, saltBytes, {
    c: 2048,
    dkLen: 64,
  });

  // Zero mnemonic bytes immediately after use (SEC-004)
  mnemonicBytes.fill(0);
  saltBytes.fill(0);

  return seed;
}

/**
 * Split a mnemonic into an array of words.
 */
export function mnemonicToWords(mnemonic: string): string[] {
  return mnemonic.trim().split(/\s+/);
}

/**
 * Pick N random word indices from a mnemonic for confirmation UI.
 */
export function pickConfirmationIndices(mnemonic: string, count = 3): number[] {
  const words = mnemonicToWords(mnemonic);
  const indices: number[] = [];
  const pool = Array.from({ length: words.length }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const pick = Math.floor(Math.random() * pool.length);
    indices.push(pool.splice(pick, 1)[0]);
  }
  return indices.sort((a, b) => a - b);
}

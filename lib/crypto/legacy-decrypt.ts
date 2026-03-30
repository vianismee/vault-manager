/**
 * legacy-decrypt.ts — CryptoJS AES decrypt wrapper for one-time migration.
 * TASK-023D
 *
 * Isolated module. Used ONLY during the legacy-to-chain migration.
 * Must never be used for any new encryption operations (DEP-011).
 */

import CryptoJS from 'crypto-js';

/**
 * Decrypt a CryptoJS AES ciphertext string using the legacy static key.
 * Returns the plaintext string, or null if decryption fails.
 */
export function decryptLegacy(encryptedValue: string, legacyKey: string): string | null {
  if (!encryptedValue) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, legacyKey);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return plaintext || null;
  } catch {
    return null;
  }
}

import CryptoJS from 'crypto-js';

// IMPORTANT: This key MUST be consistent across all environments for passwords to be decryptable
// The passwords in your database were encrypted with the key in your .env.local file
// If you change this key, all existing passwords will become undecryptable!
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'vault_zero_knowledge_encryption_key_32bytes!';

// Log on initialization to help debug
if (typeof window !== 'undefined') {
  console.log('[Encryption] Key source:', process.env.NEXT_PUBLIC_ENCRYPTION_KEY ? 'ENV' : 'FALLBACK');
  console.log('[Encryption] Key loaded:', !!ENCRYPTION_KEY);
}

export const encrypt = (data: string): string => {
  if (!data) return '';
  try {
    const encrypted = CryptoJS.AES.encrypt(data, ENCRYPTION_KEY);
    return encrypted.toString();
  } catch (error) {
    console.error('[Encryption] Error:', error);
    throw new Error('Failed to encrypt data');
  }
};

export const decrypt = (encrypted: string): string => {
  if (!encrypted) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      console.error('[Decryption] Failed - empty result');
      console.error('[Decryption] Key used:', ENCRYPTION_KEY.substring(0, 5) + '...');
      console.error('[Decryption] Encrypted preview:', encrypted.substring(0, 30) + '...');
      return '[Unable to decrypt - wrong encryption key?]';
    }

    return decrypted;
  } catch (error) {
    console.error('[Decryption] Error:', error);
    return '[Decryption failed]';
  }
};

export const generateEncryptionKey = (): string => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

// Get the current encryption key (for debugging)
export const getEncryptionKeyInfo = () => ({
  isFromEnv: !!process.env.NEXT_PUBLIC_ENCRYPTION_KEY,
  keyLength: ENCRYPTION_KEY.length,
  keyPreview: ENCRYPTION_KEY.substring(0, 5) + '...',
});

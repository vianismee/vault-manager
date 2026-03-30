import { describe, it, expect } from 'vitest';
import { deriveKey, deriveVaultKey, deriveIdentityKey, deriveCategoryKey, HD_PATHS } from '../../crypto/hd-keys';
import { mnemonicToMasterSeed } from '../../crypto/seedphrase';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function getMasterSeed() {
  return mnemonicToMasterSeed(TEST_MNEMONIC);
}

describe('hd-keys', () => {
  it('derives a 32-byte vault key', async () => {
    const seed = await getMasterSeed();
    const key = deriveVaultKey(seed);
    expect(key).toHaveLength(32);
  });

  it('key derivation is deterministic', async () => {
    const seed1 = await getMasterSeed();
    const seed2 = await getMasterSeed();
    const k1 = deriveVaultKey(seed1);
    const k2 = deriveVaultKey(seed2);
    expect(k1).toEqual(k2);
  });

  it('different paths produce different keys', async () => {
    const seed = await getMasterSeed();
    const vaultKey = deriveKey(seed, HD_PATHS.VAULT_KEY);
    const identityKey = deriveKey(seed, HD_PATHS.IDENTITY);
    const hmacKey = deriveKey(seed, HD_PATHS.HMAC_KEY);
    expect(vaultKey).not.toEqual(identityKey);
    expect(vaultKey).not.toEqual(hmacKey);
    expect(identityKey).not.toEqual(hmacKey);
  });

  it('different category indices produce different keys', async () => {
    const seed = await getMasterSeed();
    const cat0 = deriveCategoryKey(seed, 0);
    const cat1 = deriveCategoryKey(seed, 1);
    const cat2 = deriveCategoryKey(seed, 2);
    expect(cat0).not.toEqual(cat1);
    expect(cat1).not.toEqual(cat2);
  });

  it('same category index is deterministic', async () => {
    const seed = await getMasterSeed();
    const a = deriveCategoryKey(seed, 5);
    const b = deriveCategoryKey(seed, 5);
    expect(a).toEqual(b);
  });

  it('identity key derivation produces 32 bytes', async () => {
    const seed = await getMasterSeed();
    const key = deriveIdentityKey(seed);
    expect(key).toHaveLength(32);
  });

  it('throws on invalid master seed length', async () => {
    const shortSeed = new Uint8Array(32);
    expect(() => deriveKey(shortSeed, HD_PATHS.VAULT_KEY)).toThrow('64 bytes');
  });

  it('throws on invalid path format', async () => {
    const seed = await getMasterSeed();
    expect(() => deriveKey(seed, 'invalid/path')).toThrow('Invalid HD path');
  });

  it('different master seeds produce different vault keys', async () => {
    const mnemonic2 =
      'legal winner thank year wave sausage worth useful legal winner thank yellow';
    const seed1 = await getMasterSeed();
    const seed2 = await mnemonicToMasterSeed(mnemonic2);
    const k1 = deriveVaultKey(seed1);
    const k2 = deriveVaultKey(seed2);
    expect(k1).not.toEqual(k2);
  });
});

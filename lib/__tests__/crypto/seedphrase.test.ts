import { describe, it, expect } from 'vitest';
import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToMasterSeed,
  mnemonicToWords,
  pickConfirmationIndices,
} from '../../crypto/seedphrase';

describe('seedphrase', () => {
  it('generates a valid 24-word mnemonic', () => {
    const mnemonic = generateMnemonic(24);
    expect(mnemonicToWords(mnemonic)).toHaveLength(24);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('generates a valid 12-word mnemonic', () => {
    const mnemonic = generateMnemonic(12);
    expect(mnemonicToWords(mnemonic)).toHaveLength(12);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('generates different mnemonics each call', () => {
    const a = generateMnemonic(24);
    const b = generateMnemonic(24);
    expect(a).not.toBe(b);
  });

  it('validates a known-good mnemonic', () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('rejects an invalid mnemonic', () => {
    expect(validateMnemonic('not a valid mnemonic phrase at all')).toBe(false);
    expect(validateMnemonic('')).toBe(false);
  });

  it('derives a 64-byte master seed deterministically', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const seed1 = await mnemonicToMasterSeed(mnemonic);
    const seed2 = await mnemonicToMasterSeed(mnemonic);
    expect(seed1).toHaveLength(64);
    expect(seed1).toEqual(seed2);
  });

  it('derives different seeds for different mnemonics', async () => {
    const m1 = generateMnemonic(24);
    const m2 = generateMnemonic(24);
    const s1 = await mnemonicToMasterSeed(m1);
    const s2 = await mnemonicToMasterSeed(m2);
    expect(s1).not.toEqual(s2);
  });

  it('derives different seeds with different passphrases', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const s1 = await mnemonicToMasterSeed(mnemonic, '');
    const s2 = await mnemonicToMasterSeed(mnemonic, 'passphrase');
    expect(s1).not.toEqual(s2);
  });

  it('throws on invalid mnemonic input to mnemonicToMasterSeed', async () => {
    await expect(mnemonicToMasterSeed('invalid phrase')).rejects.toThrow('Invalid BIP-39');
  });

  it('pickConfirmationIndices returns correct count and sorted', () => {
    const mnemonic = generateMnemonic(24);
    const indices = pickConfirmationIndices(mnemonic, 3);
    expect(indices).toHaveLength(3);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    // All indices should be within range
    for (const i of indices) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(24);
    }
    // No duplicates
    expect(new Set(indices).size).toBe(3);
  });
});

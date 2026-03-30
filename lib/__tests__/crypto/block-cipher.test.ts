import { describe, it, expect } from 'vitest';
import {
  importAesKey,
  encryptAesGcm,
  decryptAesGcm,
  encryptPayload,
  decryptPayload,
} from '../../crypto/block-cipher';

async function makeKey() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  // We need a copy because importAesKey zeros the original
  const rawCopy = raw.slice();
  const key = await importAesKey(raw);
  return { key, raw: rawCopy };
}

describe('block-cipher (AES-256-GCM)', () => {
  it('encrypt/decrypt roundtrip', async () => {
    const { key } = await makeKey();
    const plaintext = new TextEncoder().encode('super secret password');
    const encrypted = await encryptAesGcm(key, plaintext);
    const decrypted = await decryptAesGcm(key, encrypted);
    expect(new TextDecoder().decode(decrypted)).toBe('super secret password');
  });

  it('encrypted output is different from plaintext', async () => {
    const { key } = await makeKey();
    const plaintext = new TextEncoder().encode('hello');
    const encrypted = await encryptAesGcm(key, plaintext);
    expect(encrypted).not.toEqual(plaintext);
  });

  it('two encryptions of same plaintext produce different ciphertexts (random IV)', async () => {
    const { key } = await makeKey();
    const plaintext = new TextEncoder().encode('same data');
    const c1 = await encryptAesGcm(key, plaintext);
    const c2 = await encryptAesGcm(key, plaintext);
    expect(c1).not.toEqual(c2);
  });

  it('decryption fails with wrong key', async () => {
    const { key: key1 } = await makeKey();
    const { key: key2 } = await makeKey();
    const plaintext = new TextEncoder().encode('secret');
    const encrypted = await encryptAesGcm(key1, plaintext);
    await expect(decryptAesGcm(key2, encrypted)).rejects.toThrow();
  });

  it('decryption fails on tampered ciphertext', async () => {
    const { key } = await makeKey();
    const plaintext = new TextEncoder().encode('secret');
    const encrypted = await encryptAesGcm(key, plaintext);
    const tampered = new Uint8Array(encrypted);
    tampered[tampered.length - 1] ^= 0xff; // flip last byte (auth tag)
    await expect(decryptAesGcm(key, tampered)).rejects.toThrow();
  });

  it('throws on short encrypted data', async () => {
    const { key } = await makeKey();
    await expect(decryptAesGcm(key, new Uint8Array(4))).rejects.toThrow('too short');
  });

  it('importAesKey throws on wrong key length', async () => {
    await expect(importAesKey(new Uint8Array(16))).rejects.toThrow('32 bytes');
  });

  it('importAesKey zeros raw bytes after import', async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    await importAesKey(raw);
    expect(raw.every((b) => b === 0)).toBe(true);
  });

  it('encryptPayload/decryptPayload roundtrip for JSON objects', async () => {
    const { key } = await makeKey();
    const payload = { id: 'abc123', op: 'CREATE', title: 'GitHub', password: 'hunter2' };
    const encrypted = await encryptPayload(key, payload);
    expect(typeof encrypted).toBe('string');
    const decrypted = await decryptPayload(key, encrypted);
    expect(decrypted).toEqual(payload);
  });
});

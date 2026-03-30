import { describe, it, expect } from 'vitest';
import {
  deriveEd25519Keypair,
  sign,
  verify,
  deriveX25519Keypair,
  ecdhSharedSecret,
  publicKeyToHex,
  hexToPublicKey,
} from '../../crypto/keypair';

const seed32 = new Uint8Array(32).fill(1);
const seed32b = new Uint8Array(32).fill(2);

describe('keypair (Ed25519)', () => {
  it('derives a keypair with correct key lengths', () => {
    const kp = deriveEd25519Keypair(seed32);
    expect(kp.privateKey).toHaveLength(32);
    expect(kp.publicKey).toHaveLength(32);
  });

  it('keypair derivation is deterministic', () => {
    const kp1 = deriveEd25519Keypair(seed32);
    const kp2 = deriveEd25519Keypair(seed32);
    expect(kp1.publicKey).toEqual(kp2.publicKey);
  });

  it('different seeds produce different keypairs', () => {
    const kp1 = deriveEd25519Keypair(seed32);
    const kp2 = deriveEd25519Keypair(seed32b);
    expect(kp1.publicKey).not.toEqual(kp2.publicKey);
  });

  it('sign produces a 64-byte signature', () => {
    const kp = deriveEd25519Keypair(seed32);
    const message = new TextEncoder().encode('hello');
    const sig = sign(message, kp.privateKey);
    expect(sig).toHaveLength(64);
  });

  it('sign/verify roundtrip succeeds', () => {
    const kp = deriveEd25519Keypair(seed32);
    const message = new TextEncoder().encode('test message');
    const sig = sign(message, kp.privateKey);
    expect(verify(message, sig, kp.publicKey)).toBe(true);
  });

  it('verify returns false for wrong message', () => {
    const kp = deriveEd25519Keypair(seed32);
    const message = new TextEncoder().encode('test message');
    const wrongMessage = new TextEncoder().encode('tampered message');
    const sig = sign(message, kp.privateKey);
    expect(verify(wrongMessage, sig, kp.publicKey)).toBe(false);
  });

  it('verify returns false for wrong public key', () => {
    const kp1 = deriveEd25519Keypair(seed32);
    const kp2 = deriveEd25519Keypair(seed32b);
    const message = new TextEncoder().encode('test');
    const sig = sign(message, kp1.privateKey);
    expect(verify(message, sig, kp2.publicKey)).toBe(false);
  });

  it('verify returns false for tampered signature', () => {
    const kp = deriveEd25519Keypair(seed32);
    const message = new TextEncoder().encode('test');
    const sig = sign(message, kp.privateKey);
    const tampered = new Uint8Array(sig);
    tampered[0] ^= 0xff;
    expect(verify(message, tampered, kp.publicKey)).toBe(false);
  });

  it('throws on wrong seed length', () => {
    expect(() => deriveEd25519Keypair(new Uint8Array(16))).toThrow('32 bytes');
  });
});

describe('keypair (X25519 ECDH)', () => {
  it('derives X25519 keypair', () => {
    const kp = deriveX25519Keypair(seed32);
    expect(kp.privateKey).toHaveLength(32);
    expect(kp.publicKey).toHaveLength(32);
  });

  it('ECDH shared secret is symmetric', () => {
    const kpA = deriveX25519Keypair(seed32);
    const kpB = deriveX25519Keypair(seed32b);
    const secretA = ecdhSharedSecret(kpA.privateKey, kpB.publicKey);
    const secretB = ecdhSharedSecret(kpB.privateKey, kpA.publicKey);
    expect(secretA).toEqual(secretB);
  });

  it('ECDH shared secret differs for different key pairs', () => {
    const kpA = deriveX25519Keypair(seed32);
    const kpB = deriveX25519Keypair(seed32b);
    const kpC = deriveX25519Keypair(new Uint8Array(32).fill(3));
    const secretAB = ecdhSharedSecret(kpA.privateKey, kpB.publicKey);
    const secretAC = ecdhSharedSecret(kpA.privateKey, kpC.publicKey);
    expect(secretAB).not.toEqual(secretAC);
  });
});

describe('keypair (hex encoding)', () => {
  it('publicKeyToHex / hexToPublicKey roundtrip', () => {
    const kp = deriveEd25519Keypair(seed32);
    const hex = publicKeyToHex(kp.publicKey);
    expect(hex).toHaveLength(64);
    expect(hexToPublicKey(hex)).toEqual(kp.publicKey);
  });
});

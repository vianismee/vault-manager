/**
 * post-quantum.ts — SPHINCS+ and ML-KEM-768 post-quantum cryptography.
 * Phase PQ-1/2 — CON-001: @noble/post-quantum is beta; does not block Phases 1–5.
 * REQ-008, REQ-009, REQ-010, DEP-003
 *
 * TODO (Phase PQ-1):
 *   - Install @noble/post-quantum when stable
 *   - Implement SPHINCS+-SHA2-256s keypair derivation, sign, verify
 *   - Implement ML-KEM-768 keypair derivation, encapsulate, decapsulate
 */

export interface SphincsKeypair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface MlKemKeypair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface MlKemEncapsulated {
  ciphertext: Uint8Array;
  sharedSecret: Uint8Array;
}

// Placeholder — will be implemented in Phase PQ-1
export async function deriveSphincsKeypair(_seed: Uint8Array): Promise<SphincsKeypair> {
  throw new Error('SPHINCS+ not yet implemented — Phase PQ-1');
}

export async function sphincsSign(
  _message: Uint8Array,
  _privateKey: Uint8Array
): Promise<Uint8Array> {
  throw new Error('SPHINCS+ not yet implemented — Phase PQ-1');
}

export async function sphincsVerify(
  _message: Uint8Array,
  _signature: Uint8Array,
  _publicKey: Uint8Array
): Promise<boolean> {
  throw new Error('SPHINCS+ not yet implemented — Phase PQ-1');
}

export async function deriveMlKemKeypair(_seed: Uint8Array): Promise<MlKemKeypair> {
  throw new Error('ML-KEM-768 not yet implemented — Phase PQ-1');
}

export async function kemEncapsulate(
  _recipientPublicKey: Uint8Array
): Promise<MlKemEncapsulated> {
  throw new Error('ML-KEM-768 not yet implemented — Phase PQ-1');
}

export async function kemDecapsulate(
  _privateKey: Uint8Array,
  _ciphertext: Uint8Array
): Promise<Uint8Array> {
  throw new Error('ML-KEM-768 not yet implemented — Phase PQ-1');
}

/**
 * hybrid-sig.ts — Hybrid Ed25519 + SPHINCS+ dual signature (Phase PQ-2).
 * REQ-008, TASK-041/042
 *
 * Phase PQ-2: hybridSign/hybridVerify activates dual signing.
 * Currently a stub — will be wired up in Phase PQ-2.
 */

export interface HybridSignature {
  signature: string;    // base64 Ed25519 (64 bytes)
  signature_pq?: string; // base64 SPHINCS+ (7,856 bytes), nullable until Phase PQ-2
}

// TODO (Phase PQ-2): implement hybrid signing
export async function hybridSign(
  _blockHash: string,
  _ed25519PrivKey: Uint8Array,
  _sphincsPrivKey: Uint8Array
): Promise<HybridSignature> {
  throw new Error('hybridSign not yet implemented — Phase PQ-2');
}

export async function hybridVerify(
  _blockHash: string,
  _bundle: HybridSignature,
  _ed25519PubKey: Uint8Array,
  _sphincsPubKey: Uint8Array
): Promise<boolean> {
  throw new Error('hybridVerify not yet implemented — Phase PQ-2');
}

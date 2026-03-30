/**
 * sharing.ts — Credential sharing via X25519 ECDH (Phase PQ-1) and ML-KEM-768 (Phase PQ-2).
 * REQ-010, TASK-031/032/045
 * Phase 5 — stub for now.
 */

// TODO (Phase 5): implement credential sharing
export async function shareCredential(
  _credential: object,
  _recipientPublicKey: Uint8Array
): Promise<never> {
  throw new Error('Credential sharing not yet implemented — Phase 5');
}

export async function receiveSharedCredential(
  _encryptedPacket: object,
  _vaultPrivKey: Uint8Array
): Promise<never> {
  throw new Error('Receive shared credential not yet implemented — Phase 5');
}

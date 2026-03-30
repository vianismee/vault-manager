/**
 * device-auth.ts — Device keypair generation, authorization, and revocation.
 * REQ-005, SEC-005, TASK-020
 * Phase 3 — stub for now.
 */

// TODO (Phase 3): implement device auth
export async function generateDeviceKeypair(): Promise<never> {
  throw new Error('Device auth not yet implemented — Phase 3');
}

export async function revokeDevice(
  _deviceId: string,
  _vaultPrivKey: Uint8Array
): Promise<never> {
  throw new Error('Device revoke not yet implemented — Phase 3');
}

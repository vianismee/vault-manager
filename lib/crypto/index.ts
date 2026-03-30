/**
 * lib/crypto/index.ts — Public API for the VaultChain crypto layer.
 *
 * Phase 1 (Core Crypto) — fully implemented:
 *   seedphrase, hd-keys, keypair, block-cipher, chain, session-guard
 *
 * Phase 3+ — stubs (not yet implemented):
 *   secure-enclave, device-auth, canary, sharing, sss, hybrid-sig, post-quantum, pq-anchor
 */

// ── Phase 1: Core Crypto ──────────────────────────────────────────────────────

export * from './seedphrase';
export * from './hd-keys';
export * from './keypair';
export * from './block-cipher';
export * from './chain';
export * from './session-guard';

// ── Phase 3+: Stubs ───────────────────────────────────────────────────────────

export * from './post-quantum';
export * from './hybrid-sig';
export * from './pq-anchor';
export * from './secure-enclave';
export * from './sharing';
export * from './device-auth';
export * from './canary';
export * from './sss';

/**
 * chain.ts — Credential chain block creation, assembly, integrity verification, and replay.
 * REQ-001, REQ-002, REQ-003, REQ-006, REQ-007
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { decryptPayload, encryptPayload } from './block-cipher';
import { sign, verify } from './keypair';

export type BlockOp = 'CREATE' | 'UPDATE' | 'DELETE' | 'PQ_ANCHOR' | 'GENESIS';

export interface CredentialPayload {
  id: string;
  op: BlockOp;
  type?: 'login' | 'note' | 'card';
  title?: string;
  username?: string;
  password?: string;
  url?: string;
  totp_secret?: string;
  tags?: string[];
  notes?: string;
  original_created_at?: string;
  legacy_row_id?: string;
}

export interface ChainBlock {
  block_index: number;
  prev_hash: string;     // hex SHA-256 of previous block
  timestamp: string;     // ISO-8601
  nonce: string;         // hex random 16 bytes
  payload: string;       // base64 AES-256-GCM encrypted CredentialPayload
  block_hash: string;    // hex SHA-256(block_index + timestamp + prev_hash + nonce + payload)
  signature: string;     // base64 Ed25519 signature over block_hash bytes
  signature_pq?: string; // base64 SPHINCS+ signature (Phase PQ-2)
  canary?: boolean;
  legacy_row_id?: string;
}

export const GENESIS_PREV_HASH = '0'.repeat(64);

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64Encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64Decode(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function randomNonce(): string {
  return hexEncode(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Compute SHA-256 block hash over the concatenated fields.
 * block_hash = SHA-256(block_index || timestamp || prev_hash || nonce || payload)
 */
export function computeBlockHash(
  block_index: number,
  timestamp: string,
  prev_hash: string,
  nonce: string,
  payload: string
): string {
  const data = new TextEncoder().encode(
    String(block_index) + timestamp + prev_hash + nonce + payload
  );
  return hexEncode(sha256(data));
}

// ────────────────────────────────────────────────────────────────
// Block creation
// ────────────────────────────────────────────────────────────────

export interface CreateBlockOptions {
  block_index: number;
  prev_hash: string;
  payload: CredentialPayload;
  vaultKey: CryptoKey;
  privateKey: Uint8Array; // Ed25519 private key
  canary?: boolean;
}

export async function createBlock(opts: CreateBlockOptions): Promise<ChainBlock> {
  const timestamp = new Date().toISOString();
  const nonce = randomNonce();

  // Encrypt payload
  const encryptedPayload = await encryptPayload(opts.vaultKey, opts.payload);

  // Compute block hash
  const block_hash = computeBlockHash(
    opts.block_index,
    timestamp,
    opts.prev_hash,
    nonce,
    encryptedPayload
  );

  // Sign block_hash with Ed25519
  const hashBytes = new TextEncoder().encode(block_hash);
  const sigBytes = sign(hashBytes, opts.privateKey);

  const block: ChainBlock = {
    block_index: opts.block_index,
    prev_hash: opts.prev_hash,
    timestamp,
    nonce,
    payload: encryptedPayload,
    block_hash,
    signature: base64Encode(sigBytes),
  };

  if (opts.canary) block.canary = true;
  if (opts.payload.legacy_row_id) block.legacy_row_id = opts.payload.legacy_row_id;

  return block;
}

/**
 * Create the Genesis Block (Block 0) with a GENESIS op.
 */
export async function createGenesisBlock(
  vaultKey: CryptoKey,
  privateKey: Uint8Array,
  vaultId: string
): Promise<ChainBlock> {
  return createBlock({
    block_index: 0,
    prev_hash: GENESIS_PREV_HASH,
    payload: {
      id: vaultId,
      op: 'GENESIS',
    },
    vaultKey,
    privateKey,
  });
}

// ────────────────────────────────────────────────────────────────
// Chain integrity verification
// ────────────────────────────────────────────────────────────────

export interface ChainVerificationResult {
  valid: boolean;
  tampered_at?: number; // block_index of first invalid block
  error?: string;
}

/**
 * Walk the chain verifying:
 * 1. prev_hash linkage
 * 2. block_hash recomputation
 * 3. Ed25519 signature validity
 *
 * Returns { valid: true } or { valid: false, tampered_at, error }.
 * REQ-006
 */
export function verifyChainIntegrity(
  blocks: ChainBlock[],
  publicKey: Uint8Array
): ChainVerificationResult {
  if (blocks.length === 0) return { valid: false, error: 'Empty chain' };

  // Verify blocks are sorted by block_index
  const sorted = [...blocks].sort((a, b) => a.block_index - b.block_index);

  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i];

    // Check prev_hash linkage
    if (i === 0) {
      if (block.prev_hash !== GENESIS_PREV_HASH) {
        return {
          valid: false,
          tampered_at: block.block_index,
          error: 'Genesis block has invalid prev_hash',
        };
      }
    } else {
      const prevBlock = sorted[i - 1];
      if (block.prev_hash !== prevBlock.block_hash) {
        return {
          valid: false,
          tampered_at: block.block_index,
          error: `prev_hash mismatch at block ${block.block_index}`,
        };
      }
    }

    // Recompute and verify block_hash
    const expectedHash = computeBlockHash(
      block.block_index,
      block.timestamp,
      block.prev_hash,
      block.nonce,
      block.payload
    );
    if (expectedHash !== block.block_hash) {
      return {
        valid: false,
        tampered_at: block.block_index,
        error: `block_hash mismatch at block ${block.block_index}`,
      };
    }

    // Verify Ed25519 signature
    const hashBytes = new TextEncoder().encode(block.block_hash);
    const sigBytes = base64Decode(block.signature);
    if (!verify(hashBytes, sigBytes, publicKey)) {
      return {
        valid: false,
        tampered_at: block.block_index,
        error: `Invalid signature at block ${block.block_index}`,
      };
    }
  }

  return { valid: true };
}

// ────────────────────────────────────────────────────────────────
// Chain replay — reconstruct current vault state client-side
// ────────────────────────────────────────────────────────────────

/**
 * Replay the full chain to derive current vault state.
 * Applies CREATE/UPDATE/DELETE ops in order.
 * Returns a Map<credentialId, CredentialPayload> of live credentials.
 * REQ-007
 */
export async function replayChain(
  blocks: ChainBlock[],
  vaultKey: CryptoKey
): Promise<Map<string, CredentialPayload>> {
  const state = new Map<string, CredentialPayload>();
  const sorted = [...blocks].sort((a, b) => a.block_index - b.block_index);

  for (const block of sorted) {
    // Skip non-credential blocks
    if (block.canary) continue;

    let payload: CredentialPayload;
    try {
      payload = await decryptPayload<CredentialPayload>(vaultKey, block.payload);
    } catch {
      // Corrupted block — skip silently (chain integrity walk would catch this)
      continue;
    }

    if (payload.op === 'GENESIS' || payload.op === 'PQ_ANCHOR') continue;

    if (payload.op === 'CREATE' || payload.op === 'UPDATE') {
      state.set(payload.id, payload);
    } else if (payload.op === 'DELETE') {
      state.delete(payload.id);
    }
  }

  return state;
}

/**
 * Get the hash of the latest block (chain HEAD).
 * Returns GENESIS_PREV_HASH for an empty chain.
 */
export function getChainHead(blocks: ChainBlock[]): string {
  if (blocks.length === 0) return GENESIS_PREV_HASH;
  const sorted = [...blocks].sort((a, b) => b.block_index - a.block_index);
  return sorted[0].block_hash;
}

/**
 * Compute the Merkle root of block hashes (for PQ Anchor blocks).
 */
export function computeMerkleRoot(blockHashes: string[]): string {
  if (blockHashes.length === 0) return '0'.repeat(64);

  let layer = blockHashes.map((h) => new TextEncoder().encode(h));

  while (layer.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i]; // duplicate last if odd
      const combined = new Uint8Array(left.length + right.length);
      combined.set(left);
      combined.set(right, left.length);
      next.push(sha256(combined));
    }
    layer = next as Uint8Array<ArrayBuffer>[];
  }

  return hexEncode(layer[0]);
}

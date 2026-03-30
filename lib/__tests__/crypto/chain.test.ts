import { describe, it, expect } from 'vitest';
import {
  computeBlockHash,
  createBlock,
  createGenesisBlock,
  verifyChainIntegrity,
  replayChain,
  getChainHead,
  computeMerkleRoot,
  GENESIS_PREV_HASH,
  type ChainBlock,
} from '../../crypto/chain';
import { importAesKey } from '../../crypto/block-cipher';
import { deriveEd25519Keypair } from '../../crypto/keypair';

const SEED = new Uint8Array(32).fill(42);
const kp = deriveEd25519Keypair(SEED);

async function makeVaultKey() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return importAesKey(raw);
}

async function buildTestChain(len: number, vaultKey: CryptoKey): Promise<ChainBlock[]> {
  const blocks: ChainBlock[] = [];

  const genesis = await createGenesisBlock(vaultKey, kp.privateKey, 'vault-001');
  blocks.push(genesis);

  for (let i = 1; i < len; i++) {
    const prev = blocks[blocks.length - 1];
    const block = await createBlock({
      block_index: i,
      prev_hash: prev.block_hash,
      payload: { id: `cred-${i}`, op: 'CREATE', title: `Site ${i}`, password: `pass${i}` },
      vaultKey,
      privateKey: kp.privateKey,
    });
    blocks.push(block);
  }

  return blocks;
}

describe('chain (computeBlockHash)', () => {
  it('is deterministic', () => {
    const h1 = computeBlockHash(0, '2026-01-01T00:00:00Z', GENESIS_PREV_HASH, 'aabbcc', 'payload');
    const h2 = computeBlockHash(0, '2026-01-01T00:00:00Z', GENESIS_PREV_HASH, 'aabbcc', 'payload');
    expect(h1).toBe(h2);
  });

  it('changes when any field changes', () => {
    const base = computeBlockHash(0, 'ts', 'prev', 'nonce', 'payload');
    expect(computeBlockHash(1, 'ts', 'prev', 'nonce', 'payload')).not.toBe(base);
    expect(computeBlockHash(0, 'ts2', 'prev', 'nonce', 'payload')).not.toBe(base);
    expect(computeBlockHash(0, 'ts', 'prev2', 'nonce', 'payload')).not.toBe(base);
    expect(computeBlockHash(0, 'ts', 'prev', 'nonce2', 'payload')).not.toBe(base);
    expect(computeBlockHash(0, 'ts', 'prev', 'nonce', 'payload2')).not.toBe(base);
  });

  it('returns a 64-char hex string', () => {
    const h = computeBlockHash(0, 'ts', 'prev', 'nonce', 'payload');
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('chain (createGenesisBlock)', () => {
  it('creates block_index 0 with correct prev_hash', async () => {
    const vaultKey = await makeVaultKey();
    const genesis = await createGenesisBlock(vaultKey, kp.privateKey, 'vault-001');
    expect(genesis.block_index).toBe(0);
    expect(genesis.prev_hash).toBe(GENESIS_PREV_HASH);
    expect(genesis.block_hash).toHaveLength(64);
    expect(genesis.signature).toBeTruthy();
  });
});

describe('chain (verifyChainIntegrity)', () => {
  it('returns valid for a correct chain', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(5, vaultKey);
    const result = verifyChainIntegrity(blocks, kp.publicKey);
    expect(result.valid).toBe(true);
  });

  it('detects tampered block_hash', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(3, vaultKey);
    const tampered = blocks.map((b) => ({ ...b }));
    tampered[1].block_hash = 'a'.repeat(64); // corrupt hash
    // Also fix the next block's prev_hash to isolate to block 1
    const result = verifyChainIntegrity(tampered, kp.publicKey);
    expect(result.valid).toBe(false);
  });

  it('detects broken prev_hash linkage', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(3, vaultKey);
    const tampered = blocks.map((b) => ({ ...b }));
    tampered[2] = { ...tampered[2], prev_hash: 'b'.repeat(64) };
    const result = verifyChainIntegrity(tampered, kp.publicKey);
    expect(result.valid).toBe(false);
    expect(result.tampered_at).toBe(2);
  });

  it('detects invalid signature', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(2, vaultKey);
    const tampered = blocks.map((b) => ({ ...b }));
    tampered[1] = { ...tampered[1], signature: btoa('x'.repeat(64)) };
    const result = verifyChainIntegrity(tampered, kp.publicKey);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for wrong public key', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(2, vaultKey);
    const wrongKp = deriveEd25519Keypair(new Uint8Array(32).fill(99));
    const result = verifyChainIntegrity(blocks, wrongKp.publicKey);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for empty chain', () => {
    const result = verifyChainIntegrity([], kp.publicKey);
    expect(result.valid).toBe(false);
  });
});

describe('chain (replayChain)', () => {
  it('replays CREATE operations into vault state', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(4, vaultKey); // genesis + 3 creates
    const state = await replayChain(blocks, vaultKey);
    // genesis has op GENESIS, so 3 credentials
    expect(state.size).toBe(3);
    expect(state.get('cred-1')?.title).toBe('Site 1');
    expect(state.get('cred-3')?.title).toBe('Site 3');
  });

  it('replays DELETE — removes entry from state', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(3, vaultKey); // genesis + cred-1, cred-2
    const prev = blocks[blocks.length - 1];
    const deleteBlock = await createBlock({
      block_index: 3,
      prev_hash: prev.block_hash,
      payload: { id: 'cred-1', op: 'DELETE' },
      vaultKey,
      privateKey: kp.privateKey,
    });
    const state = await replayChain([...blocks, deleteBlock], vaultKey);
    expect(state.has('cred-1')).toBe(false);
    expect(state.has('cred-2')).toBe(true);
  });

  it('replays UPDATE — overwrites previous state', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(2, vaultKey); // genesis + cred-1
    const prev = blocks[blocks.length - 1];
    const updateBlock = await createBlock({
      block_index: 2,
      prev_hash: prev.block_hash,
      payload: { id: 'cred-1', op: 'UPDATE', title: 'Updated Site', password: 'newpass' },
      vaultKey,
      privateKey: kp.privateKey,
    });
    const state = await replayChain([...blocks, updateBlock], vaultKey);
    expect(state.get('cred-1')?.title).toBe('Updated Site');
    expect(state.get('cred-1')?.password).toBe('newpass');
  });
});

describe('chain (getChainHead)', () => {
  it('returns GENESIS_PREV_HASH for empty chain', () => {
    expect(getChainHead([])).toBe(GENESIS_PREV_HASH);
  });

  it('returns the latest block hash', async () => {
    const vaultKey = await makeVaultKey();
    const blocks = await buildTestChain(3, vaultKey);
    const head = getChainHead(blocks);
    expect(head).toBe(blocks[2].block_hash);
  });
});

describe('chain (computeMerkleRoot)', () => {
  it('returns 64 zeros for empty array', () => {
    expect(computeMerkleRoot([])).toBe('0'.repeat(64));
  });

  it('is deterministic', () => {
    const hashes = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    expect(computeMerkleRoot(hashes)).toBe(computeMerkleRoot(hashes));
  });

  it('changes when any hash changes', () => {
    const hashes = ['a'.repeat(64), 'b'.repeat(64)];
    const root1 = computeMerkleRoot(hashes);
    const root2 = computeMerkleRoot(['a'.repeat(64), 'c'.repeat(64)]);
    expect(root1).not.toBe(root2);
  });
});

/**
 * pq-anchor.ts — PQ Anchor Block generation (every 50 blocks).
 * REQ-009, CON-002, TASK-043
 * Phase PQ-2 — stub for now.
 */

export const PQ_ANCHOR_INTERVAL = 50;

// TODO (Phase PQ-2): implement PQ anchor block creation
export async function createPqAnchorBlock(
  _blockHashes: string[],
  _sphincsPrivKey: Uint8Array,
  _blockRangeStart: number,
  _blockRangeEnd: number
): Promise<never> {
  throw new Error('PQ Anchor blocks not yet implemented — Phase PQ-2');
}

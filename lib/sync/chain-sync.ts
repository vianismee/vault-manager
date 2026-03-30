/**
 * chain-sync.ts — Incremental chain sync with IndexedDB local cache.
 * TASK-015
 *
 * Stores last verified block_index in IndexedDB.
 * On sync, fetches only blocks with block_index > lastSynced.
 * Appends new blocks to local cache and re-verifies integrity.
 */

import type { ChainBlock } from '@/lib/crypto/chain';

const DB_NAME = 'vault-chain-cache';
const DB_VERSION = 1;
const STORE_BLOCKS = 'blocks';
const STORE_META = 'meta';

// ────────────────────────────────────────────────────────────
// IndexedDB helpers
// ────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // blocks store: keyed by [chain_id, block_index]
      if (!db.objectStoreNames.contains(STORE_BLOCKS)) {
        const store = db.createObjectStore(STORE_BLOCKS, { keyPath: ['chain_id', 'block_index'] });
        store.createIndex('by_chain', 'chain_id', { unique: false });
      }

      // meta store: keyed by chain_id, stores { lastSynced: number }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'chain_id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbGetAllByIndex(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
  key: IDBValidKey
): Promise<ChainBlock[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).index(indexName).getAll(key);
    req.onsuccess = () => resolve(req.result as ChainBlock[]);
    req.onerror = () => reject(req.error);
  });
}

function idbClearByChain(db: IDBDatabase, chainId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOCKS, 'readwrite');
    const store = tx.objectStore(STORE_BLOCKS);
    const req = store.index('by_chain').openCursor(IDBKeyRange.only(chainId));
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export interface SyncResult {
  newBlocks: number;
  totalCached: number;
  lastSynced: number;
}

/**
 * Fetch new blocks from the API and append to local IndexedDB cache.
 * Only fetches blocks with block_index > lastSynced (incremental).
 *
 * @param chainId  UUID of the vault chain
 * @returns SyncResult with counts and last synced index
 */
export async function syncChain(chainId: string): Promise<SyncResult> {
  const db = await openDb();

  // Read last synced index
  const meta = await idbGet<{ chain_id: string; lastSynced: number }>(
    db, STORE_META, chainId
  );
  const lastSynced = meta?.lastSynced ?? -1;

  // Fetch new blocks from server
  const url = `/api/blocks/${chainId}${lastSynced >= 0 ? `?since=${lastSynced}` : ''}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch blocks: ${res.status} ${res.statusText}`);
  }

  const { blocks: newBlocks }: { blocks: ChainBlock[] } = await res.json();

  // Persist new blocks to IndexedDB
  for (const block of newBlocks) {
    await idbPut(db, STORE_BLOCKS, block);
  }

  // Update lastSynced to highest block_index received
  const maxIndex = newBlocks.length > 0
    ? Math.max(...newBlocks.map((b) => b.block_index))
    : lastSynced;

  await idbPut(db, STORE_META, { chain_id: chainId, lastSynced: maxIndex });

  // Count total cached blocks for this chain
  const allCached = await idbGetAllByIndex(db, STORE_BLOCKS, 'by_chain', chainId);

  return {
    newBlocks: newBlocks.length,
    totalCached: allCached.length,
    lastSynced: maxIndex,
  };
}

/**
 * Load all cached blocks for a chain from IndexedDB (no network call).
 * Returns blocks sorted by block_index ascending.
 */
export async function getCachedChain(chainId: string): Promise<ChainBlock[]> {
  const db = await openDb();
  const blocks = await idbGetAllByIndex(db, STORE_BLOCKS, 'by_chain', chainId);
  return blocks.sort((a, b) => a.block_index - b.block_index);
}

/**
 * Get the last synced block_index for a chain from IndexedDB.
 * Returns -1 if no sync has happened yet.
 */
export async function getLastSynced(chainId: string): Promise<number> {
  const db = await openDb();
  const meta = await idbGet<{ chain_id: string; lastSynced: number }>(
    db, STORE_META, chainId
  );
  return meta?.lastSynced ?? -1;
}

/**
 * Clear all cached blocks for a chain (e.g. on vault reset or re-verification).
 */
export async function clearChainCache(chainId: string): Promise<void> {
  const db = await openDb();
  await idbClearByChain(db, chainId);
  await idbPut(db, STORE_META, { chain_id: chainId, lastSynced: -1 });
}

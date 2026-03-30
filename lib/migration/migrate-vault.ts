/**
 * migrate-vault.ts — Legacy flat-record → credential chain migration pipeline.
 * TASK-023E
 *
 * Flow:
 *  1. Fetch all rows from `passwords` WHERE user_id = userId
 *  2. For each row, decrypt encrypted_password using CryptoJS (legacy key)
 *  3. Map row → CredentialPayload with op: 'CREATE'
 *  4. Encrypt payload with new AES-256-GCM seedphrase-derived key
 *  5. Append as chain block with legacy_row_id set
 *  6. On any failure mid-migration → delete all blocks written in this batch
 *     and set vault_chains.migration_status = 'rolled_back'
 *
 * NOTE: Legacy table is `passwords` (not `credentials`). Column mapping:
 *   encrypted_password → decryptLegacy → password
 *   url               → url
 *   totp_secret       → plaintext (was not encrypted in old app)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptLegacy } from '@/lib/crypto/legacy-decrypt';
import { createBlock, getChainHead, type ChainBlock, type CredentialPayload } from '@/lib/crypto/chain';

// ────────────────────────────────────────────────────────────
// Legacy credential row shape (from `passwords` table)
// ────────────────────────────────────────────────────────────
export interface LegacyCredential {
  id: string;
  user_id: string;
  title: string;
  username: string | null;
  encrypted_password: string;   // CryptoJS AES — column name in passwords table
  url: string | null;           // column name in passwords table
  totp_secret: string | null;   // stored as plaintext in old app
  notes: string | null;
  category_id: string | null;
  created_at: string | null;
}

export interface MigrationOptions {
  userId: string;
  chainId: string;
  legacyKey: string;            // NEXT_PUBLIC_ENCRYPTION_KEY value
  vaultKey: CryptoKey;          // seedphrase-derived AES-256-GCM key
  privateKey: Uint8Array;       // Ed25519 private key for block signing
  supabase: SupabaseClient;
  onProgress?: (current: number, total: number, title: string) => void;
}

export interface MigrationResult {
  status: 'completed' | 'rolled_back';
  migratedCount: number;
  failedCredentials: string[];  // titles of credentials that failed to decrypt
  error?: string;
}

// ────────────────────────────────────────────────────────────
// Category lookup helper
// ────────────────────────────────────────────────────────────

async function buildCategoryMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId);

  const map = new Map<string, string>();
  for (const cat of data ?? []) {
    map.set(cat.id, cat.name);
  }
  return map;
}

// ────────────────────────────────────────────────────────────
// Main migration function
// ────────────────────────────────────────────────────────────

export async function migrateVault(opts: MigrationOptions): Promise<MigrationResult> {
  const { userId, chainId, legacyKey, vaultKey, privateKey, supabase, onProgress } = opts;

  // Mark migration as in_progress
  await supabase
    .from('vault_chains')
    .update({ migration_status: 'in_progress' })
    .eq('id', chainId);

  // 1. Fetch all legacy passwords for this user
  const { data: rows, error: fetchError } = await supabase
    .from('passwords')
    .select('id, user_id, title, username, encrypted_password, url, totp_secret, notes, category_id, created_at')
    .eq('user_id', userId);

  if (fetchError) {
    await supabase
      .from('vault_chains')
      .update({ migration_status: 'rolled_back' })
      .eq('id', chainId);
    return { status: 'rolled_back', migratedCount: 0, failedCredentials: [], error: fetchError.message };
  }

  const credentials: LegacyCredential[] = rows ?? [];
  if (credentials.length === 0) {
    await supabase
      .from('vault_chains')
      .update({ migration_status: 'completed', migrated_from_legacy: true })
      .eq('id', chainId);
    return { status: 'completed', migratedCount: 0, failedCredentials: [] };
  }

  // Build category name lookup (TASK-023K)
  const categoryMap = await buildCategoryMap(supabase, userId);

  // Track blocks inserted in this batch for rollback
  const insertedBlockIds: string[] = [];
  const failedCredentials: string[] = [];

  // Get current chain HEAD to start linking blocks
  const { data: existingBlocks } = await supabase
    .from('chain_blocks')
    .select('block_hash, block_index')
    .eq('chain_id', chainId)
    .order('block_index', { ascending: false })
    .limit(1);

  let prevHash = existingBlocks?.[0]?.block_hash ?? '0'.repeat(64);
  let nextIndex = existingBlocks?.[0]
    ? existingBlocks[0].block_index + 1
    : 0;

  try {
    for (let i = 0; i < credentials.length; i++) {
      const row = credentials[i];
      onProgress?.(i + 1, credentials.length, row.title);

      // 2. Decrypt password (stored as CryptoJS AES in passwords table)
      const password = decryptLegacy(row.encrypted_password, legacyKey);
      if (password === null) {
        // Record decryption failure but continue migration
        failedCredentials.push(row.title);
        continue;
      }

      // totp_secret was stored as plaintext in the old app
      const totpSecret = row.totp_secret ?? undefined;

      // 3. Build CredentialPayload (categories → tags)
      const tags: string[] = [];
      if (row.category_id && categoryMap.has(row.category_id)) {
        tags.push(categoryMap.get(row.category_id)!);
      }

      const payload: CredentialPayload = {
        id: row.id,
        op: 'CREATE',
        type: 'login',
        title: row.title,
        username: row.username ?? undefined,
        password,
        url: row.url ?? undefined,
        totp_secret: totpSecret,
        tags,
        notes: row.notes ?? undefined,
        original_created_at: row.created_at ?? undefined,
        legacy_row_id: row.id,
      };

      // 4 & 5. Encrypt + build chain block
      const block = await createBlock({
        block_index: nextIndex,
        prev_hash: prevHash,
        payload,
        vaultKey,
        privateKey,
      });

      // Insert block to Supabase with legacy_row_id
      const { data: inserted, error: insertError } = await supabase
        .from('chain_blocks')
        .insert({
          chain_id: chainId,
          block_index: block.block_index,
          prev_hash: block.prev_hash,
          timestamp: block.timestamp,
          nonce: block.nonce,
          payload: block.payload,
          block_hash: block.block_hash,
          signature: block.signature,
          legacy_row_id: row.id,
        })
        .select('id')
        .single();

      if (insertError || !inserted) {
        throw new Error(`Failed to insert block for credential "${row.title}": ${insertError?.message}`);
      }

      insertedBlockIds.push(inserted.id);
      prevHash = block.block_hash;
      nextIndex++;
    }

    // All blocks inserted — mark migration completed
    await supabase
      .from('vault_chains')
      .update({ migration_status: 'completed', migrated_from_legacy: true })
      .eq('id', chainId);

    return {
      status: 'completed',
      migratedCount: insertedBlockIds.length,
      failedCredentials,
    };
  } catch (err) {
    // 6. Rollback — delete all blocks written in this batch
    await rollbackMigration(supabase, chainId, insertedBlockIds);
    return {
      status: 'rolled_back',
      migratedCount: 0,
      failedCredentials,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ────────────────────────────────────────────────────────────
// Archive step (TASK-023H)
// Called after user confirms migration is correct.
// ────────────────────────────────────────────────────────────

export async function archiveLegacyCredentials(
  supabase: SupabaseClient,
  userId: string,
  chainId: string
): Promise<void> {
  // Mark the chain as fully migrated (source of truth for the migration guard)
  await supabase
    .from('vault_chains')
    .update({ migration_status: 'completed', migrated_from_legacy: true })
    .eq('id', chainId);

  // Note: passwords table has no migrated_at column, so individual rows are
  // not archived. The migration_status = 'completed' flag on the chain is
  // sufficient to prevent the migration banner from showing again.
}

// ────────────────────────────────────────────────────────────
// Rollback (TASK-023I)
// ────────────────────────────────────────────────────────────

export async function rollbackMigration(
  supabase: SupabaseClient,
  chainId: string,
  blockIds?: string[]
): Promise<void> {
  if (blockIds && blockIds.length > 0) {
    // Delete specific blocks inserted in this batch
    await supabase
      .from('chain_blocks')
      .delete()
      .in('id', blockIds);
  } else {
    // Delete all blocks with legacy_row_id IS NOT NULL for this chain
    await supabase
      .from('chain_blocks')
      .delete()
      .eq('chain_id', chainId)
      .not('legacy_row_id', 'is', null);
  }

  await supabase
    .from('vault_chains')
    .update({ migration_status: 'rolled_back' })
    .eq('id', chainId);
}

// ────────────────────────────────────────────────────────────
// Detection helper (TASK-023F)
// Returns count of un-migrated legacy credentials for a user.
// ────────────────────────────────────────────────────────────

export async function countLegacyCredentials(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from('passwords')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count ?? 0;
}

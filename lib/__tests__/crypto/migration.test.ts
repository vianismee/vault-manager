import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateVault, rollbackMigration, archiveLegacyCredentials, countLegacyCredentials } from '../../migration/migrate-vault';
import { decryptLegacy } from '../../crypto/legacy-decrypt';
import { importAesKey } from '../../crypto/block-cipher';
import { deriveEd25519Keypair } from '../../crypto/keypair';
import { decryptPayload } from '../../crypto/block-cipher';

// ────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────

// Minimal in-memory Supabase mock
function buildSupabaseMock(
  credentials: object[],
  categories: object[] = [],
  blockInserts: object[] = []
) {
  const insertedBlocks: object[] = blockInserts;

  const makeMock = (tableName: string) => {
    let filters: Record<string, unknown> = {};
    let rows: object[] = [];

    if (tableName === 'credentials') rows = credentials;
    if (tableName === 'categories') rows = categories;
    if (tableName === 'chain_blocks') rows = [];
    if (tableName === 'vault_chains') rows = [];

    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation((data: object) => {
        const inserted = { id: `block-${insertedBlocks.length + 1}`, ...data };
        insertedBlocks.push(inserted);
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
        };
      }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    return chain;
  };

  const supabase = {
    _insertedBlocks: insertedBlocks,
    from: vi.fn().mockImplementation(makeMock),
  };

  return supabase as unknown as import('@supabase/supabase-js').SupabaseClient & { _insertedBlocks: object[] };
}

// ────────────────────────────────────────────────────────────
// decryptLegacy tests
// ────────────────────────────────────────────────────────────

describe('decryptLegacy', () => {
  it('returns null for empty string', () => {
    expect(decryptLegacy('', 'anykey')).toBeNull();
  });

  it('returns null for invalid ciphertext', () => {
    expect(decryptLegacy('not-a-valid-ciphertext', 'key')).toBeNull();
  });

  it('roundtrip: encrypt with CryptoJS then decryptLegacy', async () => {
    const CryptoJS = (await import('crypto-js')).default;
    const key = 'test_legacy_key_32bytes__________';
    const plaintext = 'my-secret-password';
    const encrypted = CryptoJS.AES.encrypt(plaintext, key).toString();
    const decrypted = decryptLegacy(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });
});

// ────────────────────────────────────────────────────────────
// migrateVault tests
// ────────────────────────────────────────────────────────────

const LEGACY_KEY = 'vault_zero_knowledge_encryption_key_32bytes!';
const SEED = new Uint8Array(32).fill(7);
const KP = deriveEd25519Keypair(SEED);

async function makeVaultKey() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return importAesKey(raw);
}

async function makeLegacyRow(id: string, title: string, password: string, category = 'General') {
  const CryptoJS = (await import('crypto-js')).default;
  return {
    id,
    user_id: 'user-001',
    title,
    username: `user_${id}`,
    password_encrypted: CryptoJS.AES.encrypt(password, LEGACY_KEY).toString(),
    website_url: `https://${title.toLowerCase()}.com`,
    totp_secret: null,
    notes: null,
    category,
    category_id: null,
    created_at: '2025-01-01T00:00:00Z',
  };
}

describe('migrateVault', () => {
  it('migrates N credentials — block count matches row count', async () => {
    const CryptoJS = (await import('crypto-js')).default;
    const rows = await Promise.all([
      makeLegacyRow('cred-1', 'GitHub', 'gh-pass-1'),
      makeLegacyRow('cred-2', 'Gmail', 'gmail-pass-2'),
      makeLegacyRow('cred-3', 'AWS', 'aws-pass-3'),
    ]);

    const insertedBlocks: object[] = [];
    const supabase = buildSupabaseMock(rows, [], insertedBlocks);

    // Override from('credentials').select().eq().is() to return our rows
    let chainBlockQueryCount = 0;
    supabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'credentials') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockResolvedValue({ data: rows, error: null }),
        };
      }
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'vault_chains') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'chain_blocks') {
        chainBlockQueryCount++;
        if (chainBlockQueryCount === 1) {
          // getChainHead query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        // Insert queries
        return {
          insert: vi.fn().mockImplementation((data: object) => {
            const inserted = { id: `block-${insertedBlocks.length + 1}`, ...data };
            insertedBlocks.push(inserted);
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
            };
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }) as unknown as typeof supabase.from;

    const vaultKey = await makeVaultKey();
    const result = await migrateVault({
      userId: 'user-001',
      chainId: 'chain-001',
      legacyKey: LEGACY_KEY,
      vaultKey,
      privateKey: KP.privateKey,
      supabase: supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
    });

    expect(result.status).toBe('completed');
    expect(result.migratedCount).toBe(3);
    expect(result.failedCredentials).toHaveLength(0);
    expect(insertedBlocks).toHaveLength(3);
  });

  it('sets legacy_row_id on each inserted block', async () => {
    const rows = [await makeLegacyRow('cred-a', 'Notion', 'notion-pass')];
    const insertedBlocks: Array<{ legacy_row_id?: string }> = [];

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'credentials') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockResolvedValue({ data: rows, error: null }) };
        }
        if (table === 'categories') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        if (table === 'vault_chains') {
          return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }
        if (table === 'chain_blocks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockImplementation((data: { legacy_row_id?: string }) => {
              insertedBlocks.push(data);
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'blk-1', ...data }, error: null }),
              };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const vaultKey = await makeVaultKey();
    const result = await migrateVault({
      userId: 'user-001',
      chainId: 'chain-001',
      legacyKey: LEGACY_KEY,
      vaultKey,
      privateKey: KP.privateKey,
      supabase,
    });

    expect(result.status).toBe('completed');
    expect(insertedBlocks[0].legacy_row_id).toBe('cred-a');
  });

  it('mid-migration insert failure triggers rollback (zero blocks committed)', async () => {
    const rows = await Promise.all([
      makeLegacyRow('cred-1', 'Site1', 'pass1'),
      makeLegacyRow('cred-2', 'Site2', 'pass2'),
    ]);

    let insertCount = 0;
    const deletedIds: string[] = [];

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'credentials') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockResolvedValue({ data: rows, error: null }) };
        }
        if (table === 'categories') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        if (table === 'vault_chains') {
          return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }
        if (table === 'chain_blocks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockImplementation((data: object) => {
              insertCount++;
              if (insertCount === 2) {
                // Fail on second insert
                return {
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
                };
              }
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: `blk-${insertCount}` }, error: null }),
              };
            }),
            delete: vi.fn().mockReturnThis(),
            in: vi.fn().mockImplementation((col: string, ids: string[]) => {
              deletedIds.push(...ids);
              return { data: null, error: null };
            }),
            not: vi.fn().mockReturnThis(),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const vaultKey = await makeVaultKey();
    const result = await migrateVault({
      userId: 'user-001',
      chainId: 'chain-001',
      legacyKey: LEGACY_KEY,
      vaultKey,
      privateKey: KP.privateKey,
      supabase,
    });

    expect(result.status).toBe('rolled_back');
    expect(result.migratedCount).toBe(0);
    // The first block that succeeded should have been in the rollback delete list
    expect(deletedIds).toContain('blk-1');
  });
});

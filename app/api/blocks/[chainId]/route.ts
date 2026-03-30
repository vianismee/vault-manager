/**
 * GET /api/blocks/[chainId]
 *
 * TASK-013 — Return all blocks for a chain ordered by block_index ascending.
 * Supports incremental sync via ?since=<block_index> query param (TASK-015).
 *
 * Server returns ciphertext only — zero-knowledge (GUD-001).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface RouteContext {
  params: Promise<{ chainId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { chainId } = await context.params;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since'); // block_index for incremental sync

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          },
        },
      }
    );

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: chain, error: chainError } = await supabase
      .from('vault_chains')
      .select('id, user_id')
      .eq('id', chainId)
      .eq('user_id', user.id)
      .single();

    if (chainError || !chain) {
      return NextResponse.json({ error: 'Vault chain not found' }, { status: 404 });
    }

    // Build query — exclude canary blocks from normal fetch (SEC-007)
    let query = supabase
      .from('chain_blocks')
      .select(
        'id, chain_id, block_index, prev_hash, timestamp, nonce, payload, block_hash, signature, signature_pq, legacy_row_id'
      )
      .eq('chain_id', chainId)
      .eq('canary', false)
      .order('block_index', { ascending: true });

    // Incremental sync: only fetch blocks after last synced index (TASK-015)
    if (since !== null) {
      const sinceIndex = parseInt(since, 10);
      if (!isNaN(sinceIndex)) {
        query = query.gt('block_index', sinceIndex);
      }
    }

    const { data: blocks, error: blocksError } = await query;

    if (blocksError) {
      return NextResponse.json({ error: blocksError.message }, { status: 500 });
    }

    return NextResponse.json({ blocks: blocks ?? [] }, { status: 200 });
  } catch (err) {
    console.error('[blocks/chainId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/blocks/append
 *
 * TASK-012 — Append a new block to the credential chain.
 *
 * Validation:
 *  1. Authenticate user via Supabase session cookie
 *  2. Load vault_chains row; reject if status = 'frozen' (SEC-006)
 *  3. Verify Ed25519 signature (block_hash, signature) against vault public_key
 *  4. Verify prev_hash matches current chain HEAD
 *  5. Insert chain_blocks row
 *
 * Server never decrypts the payload — zero-knowledge (GUD-001).
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { verify, hexToPublicKey } from '@/lib/crypto/keypair';

interface AppendBlockRequest {
  chain_id: string;
  block_index: number;
  prev_hash: string;
  timestamp: string;
  nonce: string;
  payload: string;       // base64 AES-256-GCM encrypted — server never decrypts
  block_hash: string;
  signature: string;     // base64 Ed25519
  signature_pq?: string; // nullable until Phase PQ-2
  canary?: boolean;
  legacy_row_id?: string;
}

export async function POST(request: Request) {
  try {
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

    // 1. Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: AppendBlockRequest = await request.json();
    const {
      chain_id, block_index, prev_hash, timestamp,
      nonce, payload, block_hash, signature, signature_pq, canary, legacy_row_id,
    } = body;

    // Basic input validation
    if (!chain_id || block_index == null || !prev_hash || !timestamp ||
        !nonce || !payload || !block_hash || !signature) {
      return NextResponse.json({ error: 'Missing required block fields' }, { status: 400 });
    }

    // 2. Load vault chain — verify ownership + frozen status
    const { data: chain, error: chainError } = await supabase
      .from('vault_chains')
      .select('id, user_id, public_key, status')
      .eq('id', chain_id)
      .eq('user_id', user.id)
      .single();

    if (chainError || !chain) {
      return NextResponse.json({ error: 'Vault chain not found' }, { status: 404 });
    }

    if (chain.status === 'frozen') {
      return NextResponse.json({ error: 'Vault is frozen — Emergency Kill Switch active' }, { status: 403 });
    }

    // 3. Verify Ed25519 signature over block_hash
    let sigValid = false;
    try {
      const publicKey = hexToPublicKey(chain.public_key);
      const hashBytes = new TextEncoder().encode(block_hash);
      const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
      sigValid = verify(hashBytes, sigBytes, publicKey);
    } catch {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    if (!sigValid) {
      return NextResponse.json({ error: 'Invalid block signature' }, { status: 400 });
    }

    // 4. Verify prev_hash matches current chain HEAD
    const { data: headBlock } = await supabase
      .from('chain_blocks')
      .select('block_hash, block_index')
      .eq('chain_id', chain_id)
      .order('block_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    const GENESIS_PREV_HASH = '0'.repeat(64);
    const expectedPrevHash = headBlock ? headBlock.block_hash : GENESIS_PREV_HASH;
    const expectedNextIndex = headBlock ? headBlock.block_index + 1 : 0;

    if (prev_hash !== expectedPrevHash) {
      return NextResponse.json(
        { error: 'prev_hash does not match chain HEAD', expected: expectedPrevHash },
        { status: 409 }
      );
    }

    if (block_index !== expectedNextIndex) {
      return NextResponse.json(
        { error: 'block_index out of sequence', expected: expectedNextIndex },
        { status: 409 }
      );
    }

    // 5. Recompute block_hash server-side for tamper detection
    const { sha256 } = await import('@noble/hashes/sha2.js');
    const data = new TextEncoder().encode(
      String(block_index) + timestamp + prev_hash + nonce + payload
    );
    const computedHash = Array.from(sha256(data))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedHash !== block_hash) {
      return NextResponse.json({ error: 'block_hash tampered' }, { status: 400 });
    }

    // 6. Insert block
    const insertData: Record<string, unknown> = {
      chain_id,
      block_index,
      prev_hash,
      timestamp,
      nonce,
      payload,
      block_hash,
      signature,
      canary: canary ?? false,
    };
    if (signature_pq) insertData.signature_pq = signature_pq;
    if (legacy_row_id) insertData.legacy_row_id = legacy_row_id;

    const { data: newBlock, error: insertError } = await supabase
      .from('chain_blocks')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ block: newBlock }, { status: 201 });
  } catch (err) {
    console.error('[blocks/append]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

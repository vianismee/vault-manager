"use client";

/**
 * Audit Log — TASK-025
 * Tamper-evident timeline of all chain blocks.
 * Requires vault to be unlocked (vault layout handles gate).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Shield,
  ShieldAlert,
  Loader2,
  Lock,
  Unlock,
  Plus,
  Pencil,
  Trash2,
  Anchor,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useVault } from "@/contexts/vault-context";
import { verifyChainIntegrity, type ChainBlock, type CredentialPayload } from "@/lib/crypto/chain";
import { decryptPayload } from "@/lib/crypto/block-cipher";

interface AuditEntry {
  block_index: number;
  timestamp: string;
  op: CredentialPayload["op"] | "UNKNOWN";
  title: string;
  tampered: boolean;
}

const OP_ICON: Record<string, React.ReactNode> = {
  GENESIS: <Lock className="h-3.5 w-3.5" />,
  CREATE: <Plus className="h-3.5 w-3.5" />,
  UPDATE: <Pencil className="h-3.5 w-3.5" />,
  DELETE: <Trash2 className="h-3.5 w-3.5" />,
  PQ_ANCHOR: <Anchor className="h-3.5 w-3.5" />,
  UNKNOWN: <AlertTriangle className="h-3.5 w-3.5" />,
};

const OP_COLOR: Record<string, string> = {
  GENESIS: "text-primary bg-primary/10",
  CREATE: "text-green-600 bg-green-500/10",
  UPDATE: "text-amber-600 bg-amber-500/10",
  DELETE: "text-destructive bg-destructive/10",
  PQ_ANCHOR: "text-purple-600 bg-purple-500/10",
  UNKNOWN: "text-muted-foreground bg-muted",
};

export default function AuditLogPage() {
  const router = useRouter();
  const { vaultKey, publicKey, chainId, isLocked } = useVault();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [tamperedAt, setTamperedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLocked || !vaultKey || !publicKey || !chainId) return;
    loadAuditLog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultKey, chainId, isLocked]);

  async function loadAuditLog() {
    setLoading(true);
    try {
      // Fetch all blocks ordered by index
      const { data: rawBlocks } = await supabase
        .from("chain_blocks")
        .select("*")
        .eq("chain_id", chainId!)
        .order("block_index", { ascending: true });

      const blocks: ChainBlock[] = (rawBlocks ?? []).map((b: Record<string, unknown>) => ({
        block_index: b.block_index as number,
        prev_hash: b.prev_hash as string,
        timestamp: b.timestamp as string,
        nonce: b.nonce as string,
        payload: b.payload as string,
        block_hash: b.block_hash as string,
        signature: b.signature as string,
        signature_pq: b.signature_pq as string | undefined,
        canary: b.canary as boolean | undefined,
      }));

      // Verify chain integrity
      const integrity = verifyChainIntegrity(blocks, publicKey!);
      setChainValid(integrity.valid);
      setTamperedAt(integrity.tampered_at ?? null);

      // Decrypt each block to get op + title
      const auditEntries: AuditEntry[] = [];
      for (const block of blocks) {
        if (block.canary) continue;
        let op: AuditEntry["op"] = "UNKNOWN";
        let title = `Block #${block.block_index}`;
        const tampered =
          !integrity.valid &&
          integrity.tampered_at !== undefined &&
          block.block_index >= integrity.tampered_at;

        try {
          const payload = await decryptPayload<CredentialPayload>(vaultKey!, block.payload);
          op = payload.op ?? "UNKNOWN";
          title =
            op === "GENESIS"
              ? "Vault initialised"
              : op === "PQ_ANCHOR"
              ? `PQ Anchor Block`
              : payload.title ?? `Block #${block.block_index}`;
        } catch {
          op = "UNKNOWN";
        }

        auditEntries.push({ block_index: block.block_index, timestamp: block.timestamp, op, title, tampered });
      }

      setEntries(auditEntries.reverse()); // newest first
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex h-14 items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-display text-lg">Audit Log</span>
            <div className="ml-auto">
              {chainValid === true && (
                <div className="flex items-center gap-1.5 text-green-600 font-accent text-xs font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Chain verified
                </div>
              )}
              {chainValid === false && (
                <div className="flex items-center gap-1.5 text-destructive font-accent text-xs font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  Tamper detected
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6">
        {/* Chain status banner */}
        {chainValid === false && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 mb-6">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-accent text-sm font-semibold text-destructive">Chain tampered!</p>
              <p className="font-accent text-xs text-muted-foreground mt-0.5">
                Block #{tamperedAt} failed integrity verification. The vault is in read-only mode.
                Blocks at or after this point are highlighted.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-accent text-sm">No audit entries found</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-1">
              {entries.map((entry, i) => {
                const opColor = OP_COLOR[entry.op] ?? OP_COLOR.UNKNOWN;
                const opIcon = OP_ICON[entry.op] ?? OP_ICON.UNKNOWN;

                return (
                  <motion.div
                    key={entry.block_index}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className={`flex items-start gap-4 pl-0 py-2 ${entry.tampered ? "opacity-60" : ""}`}
                  >
                    {/* Icon dot */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative z-10 border-2 border-background ${opColor}`}>
                      {entry.tampered ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        opIcon
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-2.5">
                      <div className="flex items-center gap-2">
                        <p className="font-accent text-sm font-medium truncate">{entry.title}</p>
                        {entry.tampered && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                            TAMPERED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`font-accent text-[11px] font-semibold px-1.5 py-0.5 rounded ${opColor}`}>
                          {entry.op}
                        </span>
                        <span className="font-accent text-[11px] text-muted-foreground">
                          Block #{entry.block_index}
                        </span>
                        <span className="font-accent text-[11px] text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

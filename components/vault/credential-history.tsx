"use client";

/**
 * CredentialHistory — TASK-024
 * Slide-over panel showing all chain blocks for a credential with a "Restore" action.
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  RotateCcw,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useVault } from "@/contexts/vault-context";
import { decryptPayload } from "@/lib/crypto/block-cipher";
import { createBlock, type CredentialPayload } from "@/lib/crypto/chain";
import { toast } from "sonner";

interface HistoryEntry {
  block_index: number;
  timestamp: string;
  op: CredentialPayload["op"];
  payload: CredentialPayload;
}

interface Props {
  credentialId: string;
  credentialTitle: string;
  open: boolean;
  onClose: () => void;
  onRestore?: () => void;
}

const OP_LABEL: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  GENESIS: "Genesis",
};

const OP_ICON: Record<string, React.ReactNode> = {
  CREATE: <Plus className="h-3.5 w-3.5" />,
  UPDATE: <Pencil className="h-3.5 w-3.5" />,
  DELETE: <Trash2 className="h-3.5 w-3.5" />,
};

export function CredentialHistory({
  credentialId,
  credentialTitle,
  open,
  onClose,
  onRestore,
}: Props) {
  const { vaultKey, privateKey, chainId } = useVault();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    if (!vaultKey || !chainId) return;
    setLoading(true);
    try {
      const { data: rawBlocks } = await supabase
        .from("chain_blocks")
        .select("block_index, timestamp, payload")
        .eq("chain_id", chainId)
        .order("block_index", { ascending: true });

      const entries: HistoryEntry[] = [];
      for (const b of rawBlocks ?? []) {
        try {
          const payload = await decryptPayload<CredentialPayload>(vaultKey, b.payload as string);
          if (payload.id === credentialId && payload.op !== "GENESIS" && payload.op !== "PQ_ANCHOR") {
            entries.push({
              block_index: b.block_index as number,
              timestamp: b.timestamp as string,
              op: payload.op,
              payload,
            });
          }
        } catch {
          // skip undecryptable blocks
        }
      }

      setHistory(entries.reverse()); // newest first
    } finally {
      setLoading(false);
    }
  }, [vaultKey, chainId, credentialId]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  async function handleRestore(entry: HistoryEntry) {
    if (!vaultKey || !privateKey || !chainId) return;
    setRestoring(entry.block_index);
    try {
      // Get current chain HEAD
      const { data: headRow } = await supabase
        .from("chain_blocks")
        .select("block_hash, block_index")
        .eq("chain_id", chainId)
        .order("block_index", { ascending: false })
        .limit(1)
        .single();

      if (!headRow) throw new Error("Chain HEAD not found");

      // Build a new UPDATE block with the historical payload
      const restorePayload: CredentialPayload = {
        ...entry.payload,
        op: "UPDATE",
      };

      const newBlock = await createBlock({
        block_index: (headRow.block_index as number) + 1,
        prev_hash: headRow.block_hash as string,
        payload: restorePayload,
        vaultKey,
        privateKey,
      });

      const { error } = await supabase.from("chain_blocks").insert({
        chain_id: chainId,
        block_index: newBlock.block_index,
        prev_hash: newBlock.prev_hash,
        timestamp: newBlock.timestamp,
        nonce: newBlock.nonce,
        payload: newBlock.payload,
        block_hash: newBlock.block_hash,
        signature: newBlock.signature,
      });

      if (error) throw error;

      toast.success(`Restored "${entry.payload.title}" to version from ${new Date(entry.timestamp).toLocaleDateString()}`);
      onRestore?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-background border-l border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-accent text-sm font-semibold truncate">{credentialTitle}</p>
                <p className="font-accent text-[11px] text-muted-foreground">Version history</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p className="font-accent text-sm">No history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, i) => {
                    const isRevealed = revealedIndex === entry.block_index;
                    const isLatest = i === 0;

                    return (
                      <div
                        key={entry.block_index}
                        className="surface-card p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1 font-accent text-xs font-semibold px-2 py-0.5 rounded-full ${
                              entry.op === "CREATE" ? "bg-green-500/10 text-green-600" :
                              entry.op === "UPDATE" ? "bg-amber-500/10 text-amber-600" :
                              "bg-destructive/10 text-destructive"
                            }`}>
                              {OP_ICON[entry.op]}
                              {OP_LABEL[entry.op] ?? entry.op}
                            </span>
                            {isLatest && (
                              <span className="font-accent text-[10px] text-primary font-semibold px-1.5 py-0.5 rounded bg-primary/10">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="font-accent text-[11px] text-muted-foreground">
                            #{entry.block_index}
                          </span>
                        </div>

                        <p className="font-accent text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>

                        {/* Masked password */}
                        {entry.payload.password && (
                          <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
                            <span className="font-mono text-sm flex-1">
                              {isRevealed ? entry.payload.password : "•".repeat(Math.min(entry.payload.password.length, 12))}
                            </span>
                            <button
                              onClick={() => setRevealedIndex(isRevealed ? null : entry.block_index)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        )}

                        {/* Restore button (not for latest or DELETE) */}
                        {!isLatest && entry.op !== "DELETE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleRestore(entry)}
                            disabled={restoring === entry.block_index}
                          >
                            {restoring === entry.block_index ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Restore this version
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

"use client";

/**
 * Vault Snapshot Export/Import — TASK-026, TASK-027
 * Allows exporting the full credential chain as an encrypted JSON snapshot,
 * and importing/verifying a snapshot file.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  FileDown,
  FileUp,
  Loader2,
  Shield,
  Check,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useVault } from "@/contexts/vault-context";
import { encryptPayload, decryptPayload } from "@/lib/crypto/block-cipher";
import {
  verifyChainIntegrity,
  computeBlockHash,
  type ChainBlock,
} from "@/lib/crypto/chain";

type Tab = "export" | "import";

interface SnapshotManifest {
  vault_id: string;
  schema_version: number;
  chain_length: number;
  exported_at: string;
  chain_root_hash: string;
  blocks_encrypted: string; // AES-GCM encrypted JSON array of ChainBlock[]
}

// Compute simple chain root hash = SHA-256 of all block_hashes concatenated
async function computeChainRootHash(blocks: ChainBlock[]): Promise<string> {
  const sorted = [...blocks].sort((a, b) => a.block_index - b.block_index);
  const allHashes = sorted.map((b) => b.block_hash).join("");
  const bytes = new TextEncoder().encode(allHashes);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function SnapshotPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { vaultKey, publicKey, chainId } = useVault();

  const initialTab: Tab = (searchParams.get("action") as Tab) ?? "export";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<"ok" | "error" | null>(null);
  const [importError, setImportError] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export ────────────────────────────────────────────────
  async function handleExport() {
    if (!vaultKey || !publicKey || !chainId) return;
    setExporting(true);
    try {
      const { data: rawBlocks } = await supabase
        .from("chain_blocks")
        .select("*")
        .eq("chain_id", chainId)
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
        legacy_row_id: b.legacy_row_id as string | undefined,
      }));

      const chainRootHash = await computeChainRootHash(blocks);

      // Encrypt the entire blocks array with the vault key
      const blocksEncrypted = await encryptPayload(vaultKey, blocks);

      const manifest: SnapshotManifest = {
        vault_id: chainId,
        schema_version: 1,
        chain_length: blocks.length,
        exported_at: new Date().toISOString(),
        chain_root_hash: chainRootHash,
        blocks_encrypted: blocksEncrypted,
      };

      const json = JSON.stringify(manifest, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vault-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Snapshot exported — ${blocks.length} blocks`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  // ── Import ────────────────────────────────────────────────
  async function handleImport() {
    if (!importFile || !vaultKey || !publicKey) return;
    setImporting(true);
    setImportResult(null);
    setImportError("");
    try {
      const text = await importFile.text();
      const manifest: SnapshotManifest = JSON.parse(text);

      if (!manifest.blocks_encrypted || !manifest.chain_root_hash) {
        throw new Error("Invalid snapshot format");
      }

      // Decrypt blocks
      const blocks = await decryptPayload<ChainBlock[]>(vaultKey, manifest.blocks_encrypted);
      if (!Array.isArray(blocks)) throw new Error("Snapshot blocks are not an array");

      // Verify chain root hash
      const computedRoot = await computeChainRootHash(blocks);
      if (computedRoot !== manifest.chain_root_hash) {
        throw new Error("Chain root hash mismatch — snapshot may be corrupted");
      }

      // Verify chain integrity
      const integrity = verifyChainIntegrity(blocks, publicKey);
      if (!integrity.valid) {
        throw new Error(`Chain integrity failed at block #${integrity.tampered_at}: ${integrity.error}`);
      }

      setImportedCount(blocks.length);
      setImportResult("ok");
    } catch (err: unknown) {
      setImportResult("error");
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
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
            <span className="font-display text-lg">Vault Snapshot</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/60 rounded-xl mb-6">
          {(["export", "import"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-accent text-sm font-medium transition-all ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "export" ? <FileDown className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Export tab ─────────────────────────────── */}
          {tab === "export" && (
            <motion.div
              key="export"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="surface-card p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-accent text-sm font-semibold">Encrypted chain snapshot</p>
                    <p className="font-accent text-xs text-muted-foreground mt-1">
                      Exports all chain blocks encrypted with your vault key. Only you can decrypt this file using your seedphrase.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {[
                    "All credential blocks (CREATE, UPDATE, DELETE history)",
                    "Chain root hash for tamper verification",
                    "Schema version for forward compatibility",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <p className="font-accent text-xs text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className="w-full btn-primary"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting…</>
                ) : (
                  <><FileDown className="h-4 w-4 mr-2" /> Download snapshot</>
                )}
              </Button>
            </motion.div>
          )}

          {/* ── Import tab ─────────────────────────────── */}
          {tab === "import" && (
            <motion.div
              key="import"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="surface-card p-5 space-y-4">
                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  {importFile ? (
                    <p className="font-accent text-sm font-medium text-foreground">{importFile.name}</p>
                  ) : (
                    <>
                      <p className="font-accent text-sm font-medium">Click to select snapshot file</p>
                      <p className="font-accent text-xs text-muted-foreground mt-1">vault-snapshot-*.json</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setImportResult(null);
                  }}
                />

                {/* Result feedback */}
                {importResult === "ok" && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    <p className="font-accent text-sm text-green-700 dark:text-green-400">
                      Snapshot verified — {importedCount} blocks, chain integrity confirmed.
                    </p>
                  </div>
                )}
                {importResult === "error" && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="font-accent text-sm text-destructive">{importError}</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full btn-primary"
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</>
                ) : (
                  <><FileUp className="h-4 w-4 mr-2" /> Verify snapshot</>
                )}
              </Button>

              <p className="font-accent text-xs text-muted-foreground text-center">
                Snapshot verification decrypts and checks chain integrity without importing data.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

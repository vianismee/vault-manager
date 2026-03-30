"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useVault } from "@/contexts/vault-context";
import { replayChain, createBlock, type ChainBlock, type CredentialPayload } from "@/lib/crypto/chain";
import { VaultList, type Credential } from "@/components/vault/vault-list";
import { VaultDetailDialog } from "@/components/vault/vault-detail-dialog";
import { VaultListSkeleton } from "@/components/vault/vault-skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Plus, LogOut, Loader2, Shield, Key,
  Folder, Lock as LockIcon, Settings, AlertTriangle, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { isMobile } from "@/lib/mobile";

// ── Map CredentialPayload → Credential ──────────────────────
function payloadToCredential(p: CredentialPayload): Credential {
  return {
    id: p.id,
    title: p.title ?? "(no title)",
    username: p.username,
    password: p.password,           // plaintext from chain replay
    passwordEncrypted: "",          // unused for chain credentials
    websiteUrl: p.url,
    totpSecret: p.totp_secret,
    notes: p.notes,
    category: p.tags?.[0] ?? "General",
    createdAt: p.original_created_at ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function VaultPage() {
  const router = useRouter();
  const { vaultKey, privateKey, chainId } = useVault();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<Credential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "2fa">("all");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);

  // Mobile redirect
  useEffect(() => {
    if (isMobile()) {
      router.replace("/vault/mobile");
    }
  }, [router]);

  // ── Fetch + replay chain ────────────────────────────────────
  const fetchCredentials = useCallback(async () => {
    if (!vaultKey || !chainId) return;
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/auth/login"); return; }
      setUser({
        email: authUser.email,
        name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0],
      });

      // Fetch all chain blocks ordered by index
      const { data: rawBlocks, error: blocksError } = await supabase
        .from("chain_blocks")
        .select("*")
        .eq("chain_id", chainId)
        .order("block_index", { ascending: true });

      if (blocksError) throw blocksError;

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

      // Replay chain → current credential state
      const state = await replayChain(blocks, vaultKey);
      const creds = Array.from(state.values()).map(payloadToCredential);
      setCredentials(creds);

      // ── Migration guard ───────────────────────────────────────
      // If chain has no credentials (only genesis or empty) AND the user
      // has unarchived rows in the legacy passwords table → prompt migration.
      if (creds.length === 0) {
        const { data: chainRow } = await supabase
          .from("vault_chains")
          .select("migration_status")
          .eq("id", chainId)
          .single();

        if (chainRow?.migration_status !== "completed") {
          const { count } = await supabase
            .from("passwords")
            .select("id", { count: "exact", head: true })
            .eq("user_id", authUser.id);

          if ((count ?? 0) > 0) {
            setNeedsMigration(true);
          }
        }
      } else {
        setNeedsMigration(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load vault");
    } finally {
      setLoading(false);
    }
  }, [vaultKey, chainId, router]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // ── Filter ──────────────────────────────────────────────────
  useEffect(() => {
    let base = credentials;
    if (activeFilter === "2fa") base = base.filter((c) => c.totpSecret);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      base = base.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.username?.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }
    setFilteredCredentials(base);
  }, [searchQuery, credentials, activeFilter]);

  // ── Delete — appends DELETE block to chain ──────────────────
  const handleDelete = async (id: string) => {
    if (!vaultKey || !privateKey || !chainId) {
      toast.error("Seedphrase unlock required to delete credentials");
      return;
    }

    try {
      // Get chain HEAD
      const { data: headRow } = await supabase
        .from("chain_blocks")
        .select("block_hash, block_index")
        .eq("chain_id", chainId)
        .order("block_index", { ascending: false })
        .limit(1)
        .single();

      if (!headRow) throw new Error("Chain HEAD not found");

      const deletePayload: CredentialPayload = { id, op: "DELETE" };
      const block = await createBlock({
        block_index: (headRow.block_index as number) + 1,
        prev_hash: headRow.block_hash as string,
        payload: deletePayload,
        vaultKey,
        privateKey,
      });

      const res = await fetch("/api/blocks/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain_id: chainId, ...block }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Block append failed");
      }

      // Optimistic update
      setCredentials((prev) => prev.filter((c) => c.id !== id));
      setDialogOpen(false);
      toast.success("Credential deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const stats = [
    { label: "Passwords",  value: credentials.length,                                 icon: Shield,   color: "text-primary" },
    { label: "With 2FA",   value: credentials.filter((c) => c.totpSecret).length,     icon: Key,      color: "text-foreground" },
    { label: "Categories", value: new Set(credentials.map((c) => c.category)).size,   icon: Folder,   color: "text-foreground" },
  ];

  const navItems = [
    { id: "all", label: "All Passwords", icon: LockIcon, count: credentials.length },
    { id: "2fa", label: "With 2FA",      icon: Key,      count: credentials.filter((c) => c.totpSecret).length },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="w-60 shrink-0 border-r border-border/50 bg-card flex flex-col sticky top-0 h-screen">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border/40">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Shield className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-display text-base">Vault</span>
        </div>

        {/* Add button */}
        <div className="px-4 pt-4 pb-2">
          <Link href="/vault/new" className="btn-primary flex items-center justify-center gap-2 w-full">
            <Plus className="h-3.5 w-3.5" />
            New Password
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <p className="section-label px-2 pt-3 pb-1.5">Library</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveFilter(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-accent text-sm transition-colors text-left ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Stats */}
        <div className="px-4 py-3 border-t border-border/40 space-y-2">
          <p className="section-label px-1 pb-1">Overview</p>
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Icon className={`h-3 w-3 ${stat.color}`} />
                  <span className="font-accent text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <span className="font-accent text-xs font-semibold text-foreground">{stat.value}</span>
              </div>
            );
          })}
        </div>

        {/* Profile */}
        <div className="px-4 pb-4 pt-3 border-t border-border/40 space-y-1">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="font-accent text-[11px] font-bold text-primary uppercase">
                {user?.name?.slice(0, 2) ?? "??"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-accent text-sm font-semibold text-foreground truncate leading-tight">
                {user?.name ?? "My Account"}
              </p>
              <p className="font-accent text-[11px] text-muted-foreground truncate leading-tight">
                {user?.email ?? ""}
              </p>
            </div>
            <Settings className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-accent text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-background border-b border-border/50 px-6 h-14 flex items-center gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search passwords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-refined pl-9 w-full"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="font-accent text-xs text-muted-foreground">
              {filteredCredentials.length} item{filteredCredentials.length !== 1 ? "s" : ""}
            </span>
          </div>
        </header>

        {/* ── Migration banner ─────────────────────── */}
        {needsMigration && (
          <div className="mx-6 mt-4 flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-accent text-sm font-semibold text-amber-700 dark:text-amber-400">
                Legacy passwords found
              </p>
              <p className="font-accent text-xs text-muted-foreground mt-0.5">
                You have passwords stored in the old format. Migrate them to the secure chain to continue.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => router.push("/migrate")}
            >
              Migrate now
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        )}

        {/* Content area */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <VaultListSkeleton />
            </div>
          ) : credentials.length === 0 && !needsMigration ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
                <LockIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mb-2">No passwords yet</h3>
              <p className="font-accent text-[15px] text-muted-foreground max-w-xs mb-6">
                Add your first password to get started with your secure vault
              </p>
              <Link href="/vault/new" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 h-auto">
                <Plus className="h-3.5 w-3.5" />
                Add your first password
              </Link>
            </div>
          ) : filteredCredentials.length === 0 && searchQuery ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mb-2">No results</h3>
              <p className="font-accent text-[15px] text-muted-foreground">
                No passwords match &ldquo;{searchQuery}&rdquo;
              </p>
            </div>
          ) : (
            <div className="px-6 py-5">
              <VaultList
                credentials={filteredCredentials}
                onSelectCredential={(cred) => { setSelectedCredential(cred); setDialogOpen(true); }}
              />
            </div>
          )}
        </main>
      </div>

      {/* Detail dialog */}
      <VaultDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        credential={selectedCredential}
        onEdit={(cred) => router.push(`/vault/edit/${cred.id}`)}
        onDelete={handleDelete}
      />
    </div>
  );
}

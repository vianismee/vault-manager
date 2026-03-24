"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { VaultList, Credential } from "@/components/vault/vault-list";
import { VaultDetailDialog } from "@/components/vault/vault-detail-dialog";
import { VaultListSkeleton } from "@/components/vault/vault-skeleton";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  LogOut,
  Loader2,
  Shield,
  Key,
  Folder,
  Lock as LockIcon,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { isMobile } from "@/lib/mobile";

export default function VaultPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<Credential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "2fa">("all");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);

  useEffect(() => {
    if (isMobile()) {
      router.replace("/vault/mobile");
      return;
    }
    fetchCredentials();
  }, []);

  useEffect(() => {
    let base = credentials;
    if (activeFilter === "2fa") base = base.filter((c) => c.totpSecret);
    if (searchQuery) {
      base = base.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredCredentials(base);
  }, [searchQuery, credentials, activeFilter]);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      setUser({
        email: user.email,
        name: user.user_metadata?.full_name || user.email?.split("@")[0],
      });

      const { data, error } = await supabase
        .from("passwords")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const mappedData: Credential[] = (data || []).map((cred: any) => ({
        id: cred.id,
        title: cred.title,
        username: cred.username,
        passwordEncrypted: cred.encrypted_password,
        websiteUrl: cred.url,
        totpSecret: cred.totp_secret,
        notes: cred.notes,
        category: cred.category_id || "general",
        createdAt: cred.created_at,
        updatedAt: cred.updated_at,
      }));

      setCredentials(mappedData);
      setFilteredCredentials(mappedData);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCredential = (credential: Credential) => {
    setSelectedCredential(credential);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("passwords").delete().eq("id", id);
      if (error) throw error;
      setCredentials(credentials.filter((c) => c.id !== id));
      setDialogOpen(false);
      toast.success("Credential deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete credential");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const stats = [
    { label: "Passwords", value: credentials.length, icon: Shield, color: "text-primary" },
    { label: "With 2FA",  value: credentials.filter((c) => c.totpSecret).length, icon: Key, color: "text-foreground" },
    { label: "Categories", value: new Set(credentials.map((c) => c.category)).size, icon: Folder, color: "text-foreground" },
    { label: "Health",    value: "Strong", icon: LockIcon, color: "text-success" },
  ];

  const navItems = [
    { id: "all",  label: "All Passwords", icon: LockIcon,  count: credentials.length },
    { id: "2fa",  label: "With 2FA",      icon: Key,       count: credentials.filter((c) => c.totpSecret).length },
  ] as const;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Sidebar ─────────────────────────────────── */}
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
          <Link
            href="/vault/new"
            className="btn-primary flex items-center justify-center gap-2 w-full"
          >
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
            {/* Avatar */}
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

      {/* ── Main Content ─────────────────────────────── */}
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

        {/* Content area */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <VaultListSkeleton />
            </div>
          ) : credentials.length === 0 ? (
            /* Empty state — centered */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
                <LockIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mb-2">No passwords yet</h3>
              <p className="font-accent text-[15px] text-muted-foreground max-w-xs mb-6">
                Add your first password to get started with your secure vault
              </p>
              <Link
                href="/vault/new"
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 h-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                Add your first password
              </Link>
            </div>
          ) : filteredCredentials.length === 0 ? (
            /* No search results */
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
            /* Credentials list */
            <div className="px-6 py-5">
              <VaultList
                credentials={filteredCredentials}
                onSelectCredential={handleSelectCredential}
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

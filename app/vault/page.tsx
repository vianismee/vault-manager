"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { VaultList, Credential } from "@/components/vault/vault-list";
import { VaultDetailDialog } from "@/components/vault/vault-detail-dialog";
import { VaultListSkeleton, VaultStatsSkeleton } from "@/components/vault/vault-skeleton";
import { Button } from "@/components/ui/button";
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
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    // Detect mobile and redirect
    if (isMobile()) {
      setIsMobileView(true);
      router.replace("/vault/mobile");
      return;
    }

    fetchCredentials();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = credentials.filter(
        (cred) =>
          cred.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cred.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cred.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCredentials(filtered);
    } else {
      setFilteredCredentials(credentials);
    }
  }, [searchQuery, credentials]);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    {
      label: "Passwords",
      value: credentials.length,
      icon: Shield,
      color: "text-primary",
    },
    {
      label: "With 2FA",
      value: credentials.filter((c) => c.totpSecret).length,
      icon: Key,
      color: "text-foreground",
    },
    {
      label: "Categories",
      value: new Set(credentials.map((c) => c.category)).size,
      icon: Folder,
      color: "text-foreground",
    },
    {
      label: "Health",
      value: "Strong",
      icon: LockIcon,
      color: "text-success",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Clean, no blur */}
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-4 w-4" />
              </div>
              <span className="font-display text-lg">Vault</span>
              {credentials.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-muted rounded-full">
                  {credentials.length}
                </span>
              )}
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Page title and search */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-display tracking-tight mb-6">
              Your passwords
            </h1>

            {/* Search bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search passwords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-11 bg-card border-border"
                />
              </div>
              <Link
                href="/vault/new"
                className="inline-flex items-center justify-center gap-2 px-6 h-11 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Add Password
              </Link>
            </div>
          </div>

          {/* Stats cards */}
          {!loading && credentials.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={i}
                    className="p-4 bg-card border border-border rounded-xl"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                    </div>
                    <div className="text-2xl font-display tracking-tight">{stat.value}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!loading && credentials.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
                <LockIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-display mb-2">No passwords yet</h3>
              <p className="text-muted-foreground text-[15px] max-w-xs mb-6">
                Add your first password to get started with your secure vault
              </p>
              <Link
                href="/vault/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Add your first password
              </Link>
            </div>
          )}

          {/* Credentials list */}
          {loading ? (
            <VaultListSkeleton />
          ) : (
            <VaultList
              credentials={filteredCredentials}
              onSelectCredential={handleSelectCredential}
            />
          )}
        </div>
      </main>

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

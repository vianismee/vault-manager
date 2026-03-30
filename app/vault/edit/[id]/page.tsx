"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useVault } from "@/contexts/vault-context";
import { replayChain, createBlock, type ChainBlock, type CredentialPayload } from "@/lib/crypto/chain";
import { useCategories } from "@/lib/realtime/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Eye, EyeOff, Loader2, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { PasswordGenerator, getPasswordStrength } from "@/components/password/password-generator";
import { PasswordFormSkeleton } from "@/components/vault/vault-skeleton";
import { CategorySelect } from "@/components/categories/category-select";
import { CategoryManager } from "@/components/categories/category-manager";

export default function EditCredentialPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { vaultKey, privateKey, chainId } = useVault();
  const { data: categories } = useCategories();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    username: "",
    password: "",
    websiteUrl: "",
    totpSecret: "",
    notes: "",
  });

  const fetchCredential = useCallback(async () => {
    if (!vaultKey || !chainId) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

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

      const state = await replayChain(blocks, vaultKey);
      const credential = state.get(id);

      if (!credential) {
        toast.error("Credential not found");
        router.push("/vault");
        return;
      }

      setFormData({
        title: credential.title ?? "",
        username: credential.username ?? "",
        password: credential.password ?? "",
        websiteUrl: credential.url ?? "",
        totpSecret: credential.totp_secret ?? "",
        notes: credential.notes ?? "",
      });

      // Resolve category ID from stored tag name
      if (credential.tags?.[0] && categories) {
        const matched = categories.find((c) => c.name === credential.tags![0]);
        setSelectedCategoryId(matched?.id ?? null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load credential");
      router.push("/vault");
    } finally {
      setLoading(false);
    }
  }, [vaultKey, chainId, id, categories, router]);

  useEffect(() => {
    fetchCredential();
  }, [fetchCredential]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vaultKey || !privateKey || !chainId) {
      toast.error("Seedphrase unlock required to edit credentials");
      return;
    }

    setSaving(true);
    try {
      const { data: headRow, error: headError } = await supabase
        .from("chain_blocks")
        .select("block_hash, block_index")
        .eq("chain_id", chainId)
        .order("block_index", { ascending: false })
        .limit(1)
        .single();

      if (headError || !headRow) throw new Error("Chain HEAD not found");

      const categoryName = categories?.find((c) => c.id === selectedCategoryId)?.name;

      const payload: CredentialPayload = {
        id,
        op: "UPDATE",
        title: formData.title,
        username: formData.username || undefined,
        password: formData.password,
        url: formData.websiteUrl || undefined,
        totp_secret: formData.totpSecret || undefined,
        tags: categoryName ? [categoryName] : [],
        notes: formData.notes || undefined,
      };

      const block = await createBlock({
        block_index: (headRow.block_index as number) + 1,
        prev_hash: headRow.block_hash as string,
        payload,
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

      toast.success("Password updated");
      router.push("/vault");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const strength = formData.password ? getPasswordStrength(formData.password) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="container-main">
            <div className="flex h-16 items-center">
              <div className="h-5 w-20 rounded bg-muted/50 animate-pulse" />
            </div>
          </div>
        </header>
        <main className="container-main py-8">
          <div className="max-w-xl mx-auto">
            <div className="h-8 w-48 bg-muted/50 rounded mb-8 animate-pulse" />
            <PasswordFormSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container-main">
          <div className="flex h-16 items-center">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="container-main py-8">
        <div className="max-w-xl mx-auto fade-in">
          <div className="mb-8">
            <h1 className="text-2xl font-display mb-1">Edit password</h1>
            <p className="text-muted-foreground text-[15px]">
              Update your saved password for {formData.title}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="title"
                placeholder="e.g., Gmail, Netflix"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="input-clean"
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium">
                Username or email
              </label>
              <Input
                id="username"
                placeholder="john@example.com"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="input-clean"
              />
            </div>

            {/* Password */}
            <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/40">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter or generate password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="input-clean pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {strength?.label && (
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.bgColor}`}
                        style={{ width: `${strength.percent}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${strength.color}`}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <PasswordGenerator
                onPasswordGenerated={(p) => setFormData({ ...formData, password: p })}
              />
            </div>

            {/* Website URL */}
            <div className="space-y-1.5">
              <label htmlFor="websiteUrl" className="text-sm font-medium">Website</label>
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://example.com"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                className="input-clean"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Category</label>
                <button
                  type="button"
                  onClick={() => setCategoryManagerOpen(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Settings className="h-3 w-3" />
                  Manage
                </button>
              </div>
              <CategorySelect value={selectedCategoryId} onChange={setSelectedCategoryId} />
            </div>

            {/* TOTP */}
            <div className="space-y-1.5">
              <label htmlFor="totpSecret" className="text-sm font-medium">
                2FA secret (TOTP)
              </label>
              <p className="text-xs text-muted-foreground">
                Enter the secret key from your 2FA app to enable built-in OTP generation
              </p>
              <div className="relative">
                <Input
                  id="totpSecret"
                  type={showTotpSecret ? "text" : "password"}
                  placeholder="JBSWY3DPEHPK3PXP (optional)"
                  value={formData.totpSecret}
                  onChange={(e) => setFormData({ ...formData, totpSecret: e.target.value })}
                  className="input-clean pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowTotpSecret(!showTotpSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showTotpSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium">Notes</label>
              <textarea
                id="notes"
                placeholder="Additional notes or security questions..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="flex min-h-[80px] w-full rounded-lg border border-border/60 bg-background px-4 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-ring/60 focus-visible:ring-1 focus-visible:ring-ring/20 transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/vault")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="btn-primary flex-1"
                disabled={saving}
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>

      <CategoryManager
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        onCategoriesChange={() => router.refresh()}
      />
    </div>
  );
}

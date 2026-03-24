"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Eye, EyeOff, Loader2, Settings,
  Shield, Key, Lock as LockIcon, Globe, User,
  FileText, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PasswordGenerator, getPasswordStrength } from "@/components/password/password-generator";
import { CategorySelect } from "@/components/categories/category-select";
import { CategoryManager } from "@/components/categories/category-manager";

export default function NewCredentialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "", username: "", password: "",
    websiteUrl: "", totpSecret: "", notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("passwords").insert({
        user_id: user.id,
        title: formData.title,
        username: formData.username || null,
        encrypted_password: encrypt(formData.password),
        url: formData.websiteUrl || null,
        totp_secret: formData.totpSecret || null,
        notes: formData.notes || null,
        category_id: selectedCategoryId,
      });
      if (error) throw error;
      toast.success("Password saved");
      router.push("/vault");
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const set = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData({ ...formData, [key]: e.target.value });

  const strength = formData.password ? getPasswordStrength(formData.password) : null;

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-border/50 bg-card flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border/40">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Shield className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-display text-base">Vault</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="section-label px-2 pb-1.5">Navigation</p>
          <Link
            href="/vault"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-accent text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <LockIcon className="h-3.5 w-3.5 shrink-0" />
            All Passwords
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-accent text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 shrink-0" />
            Settings
          </Link>
        </nav>

        {/* Current action indicator */}
        <div className="px-4 py-3 border-t border-border/40">
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-primary/8">
            <Key className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-accent text-sm font-semibold text-primary truncate">New Password</span>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-background border-b border-border/50 px-4 md:px-8 h-14 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 font-accent text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-border" />
          <span className="font-accent text-sm text-foreground font-medium">New Password</span>
        </header>

        {/* Form */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">

            {/* Page heading */}
            <div className="mb-8">
              <h2 className="font-display mb-1">Add new password</h2>
              <p className="font-accent text-[15px] text-muted-foreground">
                All fields are encrypted before leaving your device.
              </p>
            </div>

            {/* ── Section 1: Basic Info ── */}
            <div className="surface-card p-4 md:p-6 mb-4">
              <p className="section-label mb-4">Basic Info</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div className="col-span-full space-y-1.5">
                  <label htmlFor="title" className="font-accent text-xs font-semibold text-muted-foreground">
                    Title <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="title"
                      placeholder="e.g., Gmail, Netflix, GitHub"
                      value={formData.title}
                      onChange={set("title")}
                      required
                      className="input-refined pl-9 w-full"
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-1.5">
                  <label htmlFor="username" className="font-accent text-xs font-semibold text-muted-foreground">
                    Username or email
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="username"
                      placeholder="john@example.com"
                      value={formData.username}
                      onChange={set("username")}
                      className="input-refined pl-9 w-full"
                    />
                  </div>
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <label htmlFor="websiteUrl" className="font-accent text-xs font-semibold text-muted-foreground">
                    Website
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="websiteUrl"
                      type="url"
                      placeholder="https://example.com"
                      value={formData.websiteUrl}
                      onChange={set("websiteUrl")}
                      className="input-refined pl-9 w-full"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="col-span-full space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-accent text-xs font-semibold text-muted-foreground">Category</label>
                    <button
                      type="button"
                      onClick={() => setCategoryManagerOpen(true)}
                      className="font-accent text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Settings className="h-3 w-3" />
                      Manage
                    </button>
                  </div>
                  <CategorySelect value={selectedCategoryId} onChange={setSelectedCategoryId} />
                </div>
              </div>
            </div>

            {/* ── Section 2: Password ── */}
            <div className="surface-card p-4 md:p-6 mb-4">
              <p className="section-label mb-4">Password</p>

              <div className="space-y-4">
                {/* Password input */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="font-accent text-xs font-semibold text-muted-foreground">
                    Password <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter or generate a password"
                      value={formData.password}
                      onChange={set("password")}
                      required
                      className="input-refined pr-10 w-full font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {strength?.label && (
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${strength.bgColor}`}
                          style={{ width: `${strength.percent}%` }}
                        />
                      </div>
                      <span className={`font-accent text-xs font-semibold ${strength.color}`}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Generator */}
                <div className="border-t border-border/40 pt-4">
                  <p className="section-label mb-3">Generator</p>
                  <PasswordGenerator
                    onPasswordGenerated={(p) => setFormData({ ...formData, password: p })}
                  />
                </div>
              </div>
            </div>

            {/* ── Section 3: 2FA + Notes ── */}
            <div className="surface-card p-4 md:p-6 mb-6">
              <p className="section-label mb-4">Security & Notes</p>

              <div className="space-y-4">
                {/* TOTP */}
                <div className="space-y-1.5">
                  <label htmlFor="totpSecret" className="font-accent text-xs font-semibold text-muted-foreground">
                    2FA secret (TOTP)
                    <span className="ml-2 font-normal text-muted-foreground/70">optional</span>
                  </label>
                  <p className="font-accent text-[11px] text-muted-foreground">
                    Paste the secret key from your authenticator app to enable built-in OTP generation.
                  </p>
                  <div className="relative">
                    <Input
                      id="totpSecret"
                      type={showTotpSecret ? "text" : "password"}
                      placeholder="JBSWY3DPEHPK3PXP"
                      value={formData.totpSecret}
                      onChange={set("totpSecret")}
                      className="input-refined pr-10 w-full font-mono tracking-widest"
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
                <div className="space-y-1.5 border-t border-border/40 pt-4">
                  <label htmlFor="notes" className="font-accent text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    Notes
                    <span className="font-normal text-muted-foreground/70">optional</span>
                  </label>
                  <textarea
                    id="notes"
                    placeholder="Additional notes, security questions, recovery codes..."
                    value={formData.notes}
                    onChange={set("notes")}
                    rows={3}
                    className="w-full rounded-lg border border-border/70 bg-background px-3.5 py-2.5 font-sans text-[14px] text-foreground placeholder:text-muted-foreground/70 focus:border-ring/70 focus:ring-2 focus:ring-ring/15 focus:outline-none transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/vault")}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="btn-primary px-8" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving...</>
                ) : (
                  "Save password"
                )}
              </Button>
            </div>
          </form>
        </main>
      </div>

      <CategoryManager
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        onCategoriesChange={() => router.refresh()}
      />
    </div>
  );
}

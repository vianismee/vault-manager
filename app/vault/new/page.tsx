"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordGenerator, getPasswordStrength } from "@/components/password/password-generator";

export default function NewCredentialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    username: "",
    password: "",
    websiteUrl: "",
    totpSecret: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const { error } = await supabase.from("passwords").insert({
        user_id: user.id,
        title: formData.title,
        username: formData.username || null,
        encrypted_password: encrypt(formData.password),
        url: formData.websiteUrl || null,
        totp_secret: formData.totpSecret || null,
        notes: formData.notes || null,
        category_id: null,
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

  const strength = formData.password ? getPasswordStrength(formData.password) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container-main">
          <div className="flex h-14 sm:h-16 items-center">
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

      {/* Main content */}
      <main className="container-main py-6 sm:py-8">
        <div className="max-w-xl mx-auto fade-in">
          {/* Page title */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-display mb-1 sm:mb-2">Add new password</h1>
            <p className="text-muted-foreground text-sm sm:text-[15px]">
              Securely store a new password in your vault
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="title"
                placeholder="e.g., Gmail, Netflix"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
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
                type="text"
                placeholder="john@example.com"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="input-clean"
              />
            </div>

            {/* Password with Generator */}
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
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    className="input-clean pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>

                {/* Strength Indicator */}
                {strength && strength.label && (
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

              {/* Password Generator */}
              <PasswordGenerator
                onPasswordGenerated={(generatedPassword) => {
                  setFormData({ ...formData, password: generatedPassword });
                }}
              />
            </div>

            {/* Website URL */}
            <div className="space-y-1.5">
              <label htmlFor="websiteUrl" className="text-sm font-medium">
                Website
              </label>
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://example.com"
                value={formData.websiteUrl}
                onChange={(e) =>
                  setFormData({ ...formData, websiteUrl: e.target.value })
                }
                className="input-clean"
              />
            </div>

            {/* TOTP Secret */}
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
                  onChange={(e) =>
                    setFormData({ ...formData, totpSecret: e.target.value })
                  }
                  className="input-clean pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowTotpSecret(!showTotpSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showTotpSecret ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="notes"
                placeholder="Additional notes or security questions..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
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
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save password"
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

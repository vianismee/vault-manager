"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Shield, Plus, Search, User, Key, Folder, X, Eye, EyeOff, Copy, Check, LogOut, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { decrypt } from "@/lib/encryption";
import { TOTPDisplay } from "@/components/totp/totp-display";
import { getFaviconUrl, generatePlaceholder } from "@/lib/icons";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

interface Credential {
  id: string;
  title: string;
  username?: string;
  passwordEncrypted: string;
  websiteUrl?: string;
  totpSecret?: string;
  notes?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

type Tab = "vault" | "search" | "settings";

export default function MobileVaultPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("vault");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<Credential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = credentials.filter(
        (cred) =>
          cred.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cred.username?.toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("passwords").delete().eq("id", id);
      if (error) throw error;
      setCredentials(credentials.filter((c) => c.id !== id));
      setShowDetail(false);
      toast.success("Deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const stats = [
    { label: "Passwords", value: credentials.length, icon: Shield, color: "bg-primary/10 text-primary" },
    { label: "2FA", value: credentials.filter((c) => c.totpSecret).length, icon: Key, color: "bg-muted text-foreground" },
    { label: "Categories", value: new Set(credentials.map((c) => c.category)).size, icon: Folder, color: "bg-muted text-foreground" },
  ];

  // Render content based on active tab
  const renderContent = () => {
    if (activeTab === "search") {
      return (
        <div className="flex-1 overflow-y-auto pb-24">
          {/* Search Bar */}
          <div className="sticky top-0 bg-background z-10 p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search passwords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-muted rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </div>
          </div>

          {/* Results */}
          <div className="p-4 space-y-2">
            {filteredCredentials.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No results found</p>
              </div>
            ) : (
              filteredCredentials.map((cred) => (
                <MobileVaultItem
                  key={cred.id}
                  credential={cred}
                  onClick={() => {
                    setSelectedCredential(cred);
                    setShowDetail(true);
                  }}
                />
              ))
            )}
          </div>
        </div>
      );
    }

    if (activeTab === "settings") {
      return (
        <div className="flex-1 overflow-y-auto pb-24">
          <div className="p-4 space-y-2">
            {/* Profile */}
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">My Account</p>
                  <p className="text-sm text-muted-foreground">Manage your account</p>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-card rounded-2xl overflow-hidden border border-border divide-y divide-border">
              <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-left">Security</span>
              </button>
              <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                <Key className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-left">Export Data</span>
              </button>
              <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                <Folder className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-left">Categories</span>
              </button>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 p-4 bg-card rounded-2xl border border-border text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>

            <div className="text-center pt-4">
              <p className="text-xs text-muted-foreground">Vault v1.0.0</p>
              <p className="text-xs text-muted-foreground">Your passwords, privately yours</p>
            </div>
          </div>
        </div>
      );
    }

    // Vault tab (default)
    return (
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : credentials.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <div className="h-20 w-20 rounded-3xl bg-muted flex items-center justify-center mb-4">
              <Shield className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display mb-2">No passwords yet</h2>
            <p className="text-muted-foreground text-sm mb-6">Add your first password to get started</p>
            <Link
              href="/vault/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-medium"
            >
              <Plus className="h-5 w-5" />
              Add Password
            </Link>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="p-4 grid grid-cols-3 gap-2">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className={`${stat.color} rounded-2xl p-3 text-center`}>
                    <Icon className="h-5 w-5 mx-auto mb-1 opacity-70" />
                    <div className="text-lg font-semibold">{stat.value}</div>
                    <div className="text-xs opacity-70">{stat.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Passwords */}
            <div className="px-4 pb-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Recent</h3>
              <div className="space-y-2">
                {filteredCredentials.map((cred) => (
                  <MobileVaultItem
                    key={cred.id}
                    credential={cred}
                    onClick={() => {
                      setSelectedCredential(cred);
                      setShowDetail(true);
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PWAInstallPrompt />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg">Vault</span>
        </div>
        <Link
          href="/vault/new"
          className="h-9 w-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </header>

      {/* Content */}
      {renderContent()}

      {/* Detail Modal */}
      {showDetail && selectedCredential && (
        <MobileDetailModal
          credential={selectedCredential}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onCopy={handleCopy}
          copied={copied}
          onEdit={() => router.push(`/vault/edit/${selectedCredential.id}`)}
          onDelete={() => handleDelete(selectedCredential.id)}
          onClose={() => {
            setShowDetail(false);
            setShowPassword(false);
            setCopied(null);
          }}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border pb-safe">
        <div className="flex items-center justify-around py-2 px-4">
          <TabButton
            icon={Shield}
            label="Vault"
            active={activeTab === "vault"}
            onClick={() => setActiveTab("vault")}
          />
          <TabButton
            icon={Search}
            label="Search"
            active={activeTab === "search"}
            onClick={() => setActiveTab("search")}
          />
          <TabButton
            icon={User}
            label="Settings"
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
          />
        </div>
      </nav>
    </div>
  );
}

// Mobile Vault Item Component
function MobileVaultItem({ credential, onClick }: { credential: Credential; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const faviconUrl = credential.websiteUrl && !imgError ? getFaviconUrl(credential.websiteUrl) : null;
  const placeholder = generatePlaceholder(credential.title);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-card rounded-2xl border border-border active:bg-muted/50 transition-colors text-left"
    >
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 text-lg font-semibold"
        style={{
          backgroundColor: placeholder.background,
          color: placeholder.color,
        }}
      >
        {faviconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconUrl}
            alt=""
            className="h-7 w-7"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          placeholder.initial
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{credential.title}</div>
        {credential.username && (
          <div className="text-sm text-muted-foreground truncate">{credential.username}</div>
        )}
      </div>
      {credential.totpSecret && (
        <Key className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
      )}
    </button>
  );
}

// Tab Button Component
function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className={`h-6 w-6 ${active ? "fill-current" : ""}`} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

// Mobile Detail Modal Component
function MobileDetailModal({
  credential,
  showPassword,
  onTogglePassword,
  onCopy,
  copied,
  onEdit,
  onDelete,
  onClose,
}: {
  credential: Credential;
  showPassword: boolean;
  onTogglePassword: () => void;
  onCopy: (text: string, label: string) => void;
  copied: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const faviconUrl = credential.websiteUrl && !imgError ? getFaviconUrl(credential.websiteUrl) : null;
  const placeholder = generatePlaceholder(credential.title);
  const password = showPassword ? decrypt(credential.passwordEncrypted) : "••••••••";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl border-t border-border max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1" onClick={onClose}>
          <div className="h-1.5 w-12 bg-muted rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center overflow-hidden text-xl font-semibold"
              style={{
                backgroundColor: placeholder.background,
                color: placeholder.color,
              }}
            >
              {faviconUrl && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={faviconUrl} alt="" className="h-8 w-8" onError={() => setImgError(true)} />
              ) : (
                placeholder.initial
              )}
            </div>
            <div>
              <h2 className="text-xl font-display">{credential.title}</h2>
              {credential.websiteUrl && (
                <p className="text-sm text-muted-foreground">
                  {new URL(credential.websiteUrl).hostname.replace("www.", "")}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2">
            <X className="h-6 w-6 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[50vh]">
          {/* Username */}
          {credential.username && (
            <div className="bg-muted/50 rounded-2xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Username</div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{credential.username}</span>
                <button
                  onClick={() => onCopy(credential.username!, "Username")}
                  className="p-2 rounded-xl bg-background border border-border"
                >
                  {copied === "username" ? <Check className="h-5 w-5 text-success" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
                </button>
              </div>
            </div>
          )}

          {/* Password */}
          <div className="bg-muted/50 rounded-2xl p-4">
            <div className="text-xs text-muted-foreground mb-1">Password</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg">{password}</span>
              <div className="flex gap-2">
                <button
                  onClick={onTogglePassword}
                  className="p-2 rounded-xl bg-background border border-border"
                >
                  {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                </button>
                <button
                  onClick={() => onCopy(decrypt(credential.passwordEncrypted), "Password")}
                  className="p-2 rounded-xl bg-background border border-border"
                >
                  {copied === "password" ? <Check className="h-5 w-5 text-success" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
                </button>
              </div>
            </div>
          </div>

          {/* 2FA */}
          {credential.totpSecret && (
            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-2 text-sm font-medium text-primary mb-3">
                <Key className="h-4 w-4" />
                Two-Factor Code
              </div>
              <TOTPDisplay secret={credential.totpSecret} />
            </div>
          )}

          {/* Notes */}
          {credential.notes && (
            <div className="bg-muted/50 rounded-2xl p-4">
              <div className="text-xs text-muted-foreground mb-2">Notes</div>
              <p className="text-sm leading-relaxed">{credential.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-border">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted hover:bg-muted/70 transition-colors"
          >
            <Edit className="h-5 w-5" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

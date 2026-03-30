"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CategoryManager } from "@/components/categories/category-manager";
import { ExportDialog } from "@/components/import-export/export-dialog";
import { ImportDialog } from "@/components/import-export/import-dialog";
import { Button } from "@/components/ui/button";
import {
  Folder,
  Download,
  Upload,
  Users,
  LogOut,
  User,
  Shield,
  Key,
  ChevronRight,
  AlertTriangle,
  Loader2,
  History,
  FileDown,
  FileUp,
  GitBranch,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { isMobile } from "@/lib/mobile";
import { clearEnclaveData } from "@/lib/crypto/secure-enclave";

export default function SettingsPage() {
  const router = useRouter();
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [killSwitchConfirm, setKillSwitchConfirm] = useState(false);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  /** Emergency Kill Switch (TASK-021, SEC-006) */
  const handleEmergencyKillSwitch = async () => {
    if (!killSwitchConfirm) {
      setKillSwitchConfirm(true);
      return;
    }
    setKillSwitchLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Freeze vault chain
      await supabase
        .from("vault_chains")
        .update({ status: "frozen" })
        .eq("user_id", user.id);

      // 2. Revoke all authorized devices
      await supabase
        .from("authorized_devices")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("revoked_at", null);

      // 3. Clear local enclave data (wrapped keys, WebAuthn credential)
      await clearEnclaveData();

      // 4. Sign out (invalidates JWT)
      await supabase.auth.signOut();

      toast.success("Emergency Kill Switch activated — vault frozen and all devices revoked.");
      router.push("/auth/login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Kill switch failed");
      setKillSwitchLoading(false);
      setKillSwitchConfirm(false);
    }
  };

  const handleImportComplete = () => {
    // Refresh vault data
    router.refresh();
  };

  if (isMobile()) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <span className="font-display text-lg">Settings</span>
        </header>

        {/* Content */}
        <div className="p-4 space-y-3 pb-24">
          {/* Categories */}
          <SettingsItem
            icon={<Folder className="h-5 w-5" />}
            title="Categories"
            description="Manage password categories"
            onClick={() => setCategoryManagerOpen(true)}
          />

          {/* Import */}
          <SettingsItem
            icon={<Download className="h-5 w-5" />}
            title="Import Passwords"
            description="Import from other apps"
            onClick={() => setImportDialogOpen(true)}
          />

          {/* Export */}
          <SettingsItem
            icon={<Upload className="h-5 w-5" />}
            title="Export Passwords"
            description="Backup encrypted vault"
            onClick={() => setExportDialogOpen(true)}
          />

          {/* Account */}
          <SettingsItem
            icon={<User className="h-5 w-5" />}
            title="Account"
            description="Manage your account"
            onClick={() => {/* TODO */}}
          />

          {/* Security */}
          <SettingsItem
            icon={<Shield className="h-5 w-5" />}
            title="Security"
            description="Password and security settings"
            onClick={() => {/* TODO */}}
          />

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl border border-border text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>

        {/* Dialogs */}
        <CategoryManager
          open={categoryManagerOpen}
          onOpenChange={setCategoryManagerOpen}
          onCategoriesChange={() => router.refresh()}
        />
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
        />
        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={handleImportComplete}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex h-14 items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-muted"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
            <span className="font-display text-lg">Settings</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Data Management Section */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">Data Management</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              <SettingsItem
                icon={<Folder className="h-5 w-5" />}
                title="Categories"
                description="Manage password categories"
                onClick={() => setCategoryManagerOpen(true)}
              />
              <SettingsItem
                icon={<Download className="h-5 w-5" />}
                title="Import Passwords"
                description="Import from Chrome, LastPass, Bitwarden, etc."
                onClick={() => setImportDialogOpen(true)}
              />
              <SettingsItem
                icon={<Upload className="h-5 w-5" />}
                title="Export Passwords"
                description="Download encrypted backup of your vault"
                onClick={() => setExportDialogOpen(true)}
              />
            </div>
          </section>

          {/* Sharing Section */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">Sharing</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              <SettingsItem
                icon={<Users className="h-5 w-5" />}
                title="Shared with Me"
                description="View passwords shared by others"
                onClick={() => router.push("/shared")}
              />
              <SettingsItem
                icon={<Key className="h-5 w-5" />}
                title="Transfer Vault"
                description="Transfer your account to another email"
                onClick={() => router.push("/transfer")}
              />
            </div>
          </section>

          {/* Security Chain Section */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">Secure Chain</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              <SettingsItem
                icon={<History className="h-5 w-5" />}
                title="Audit Log"
                description="View tamper-evident chain history"
                onClick={() => router.push("/vault/audit")}
              />
              <SettingsItem
                icon={<FileDown className="h-5 w-5" />}
                title="Export Vault Snapshot"
                description="Download encrypted chain backup"
                onClick={() => router.push("/vault/snapshot?action=export")}
              />
              <SettingsItem
                icon={<FileUp className="h-5 w-5" />}
                title="Import Vault Snapshot"
                description="Restore from encrypted backup"
                onClick={() => router.push("/vault/snapshot?action=import")}
              />
              <SettingsItem
                icon={<GitBranch className="h-5 w-5" />}
                title="Seedphrase Backup (SSS)"
                description="Split seedphrase into recovery shares"
                onClick={() => router.push("/vault/sss")}
              />
            </div>
          </section>

          {/* Account Section */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">Account</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              <SettingsItem
                icon={<User className="h-5 w-5" />}
                title="Profile"
                description="Manage your profile information"
                onClick={() => {/* TODO */}}
              />
              <SettingsItem
                icon={<Shield className="h-5 w-5" />}
                title="Security"
                description="Password and authentication settings"
                onClick={() => {/* TODO */}}
              />
            </div>
          </section>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 p-4 bg-card border border-border rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Sign Out</span>
          </button>

          {/* Danger Zone — Emergency Kill Switch */}
          <section>
            <h2 className="text-sm font-medium text-destructive/70 mb-3 px-1">Danger Zone</h2>
            <div className="bg-card border border-destructive/20 rounded-xl overflow-hidden p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Emergency Kill Switch</p>
                  <p className="font-accent text-xs text-muted-foreground mt-0.5">
                    Immediately freeze your vault, revoke all authorized devices, and sign out from all sessions. This cannot be undone without your seedphrase.
                  </p>
                </div>
              </div>
              {killSwitchConfirm ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="font-accent text-xs text-destructive font-medium">
                      This will lock your vault and revoke all devices. Are you sure?
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setKillSwitchConfirm(false)}
                      disabled={killSwitchLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      onClick={handleEmergencyKillSwitch}
                      disabled={killSwitchLoading}
                    >
                      {killSwitchLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Activate Kill Switch"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={handleEmergencyKillSwitch}
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Activate Emergency Kill Switch
                </Button>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Dialogs */}
      <CategoryManager
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        onCategoriesChange={() => router.refresh()}
      />
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}

function SettingsItem({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
    >
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground truncate">{description}</div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

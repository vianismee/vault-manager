"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, EyeOff, ExternalLink, Trash2, Edit, Key, Shield, FileText, X } from "lucide-react";
import { useState } from "react";
import { decrypt } from "@/lib/encryption";
import { TOTPDisplay } from "@/components/totp/totp-display";
import { toast } from "sonner";
import { Credential } from "./vault-list";
import { getFaviconUrl, generatePlaceholder } from "@/lib/icons";

interface VaultDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: Credential | null;
  onEdit?: (credential: Credential) => void;
  onDelete?: (id: string) => void;
}

export function VaultDetailDialog({
  open,
  onOpenChange,
  credential,
  onEdit,
  onDelete,
}: VaultDetailDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<"password" | "username" | null>(null);
  const [imgError, setImgError] = useState(false);

  if (!credential) return null;

  const password = showPassword ? decrypt(credential.passwordEncrypted) : "••••••••";
  const faviconUrl = credential.websiteUrl && !imgError ? getFaviconUrl(credential.websiteUrl) : null;
  const placeholder = generatePlaceholder(credential.title);

  const handleCopy = async (text: string, type: "password" | "username") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success(`${type === "password" ? "Password" : "Username"} copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  const hostname = credential.websiteUrl
    ? new URL(credential.websiteUrl).hostname.replace("www.", "")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-md overflow-hidden">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">{credential.title}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center overflow-hidden text-lg font-semibold flex-shrink-0"
              style={{
                backgroundColor: placeholder.background,
                color: placeholder.color,
              }}
            >
              {faviconUrl && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={faviconUrl}
                  alt=""
                  className="h-7 w-7"
                  onError={() => setImgError(true)}
                />
              ) : (
                placeholder.initial
              )}
            </div>

            {/* Title */}
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold truncate">{credential.title}</h2>
              {hostname && (
                <a
                  href={credential.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                  {hostname}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className="p-2 -mr-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Username */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Username</label>
            {credential.username ? (
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-sm truncate">
                  {credential.username}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 flex-shrink-0"
                  onClick={() => handleCopy(credential.username!, "username")}
                >
                  {copied === "username" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="px-3 py-2.5 text-sm text-muted-foreground italic">No username</div>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Password</label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 bg-muted/50 border border-border rounded-lg font-mono text-sm truncate">
                {password}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 flex-shrink-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 flex-shrink-0"
                onClick={() => handleCopy(decrypt(credential.passwordEncrypted), "password")}
              >
                {copied === "password" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 2FA Section */}
          {credential.totpSecret && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
                <Shield className="h-4 w-4" />
                Two-Factor Authentication
              </div>
              <TOTPDisplay secret={credential.totpSecret} />
            </div>
          )}

          {/* Notes */}
          {credential.notes && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <FileText className="h-4 w-4" />
                Notes
              </div>
              <div className="p-3 bg-muted/50 border border-border rounded-lg text-sm leading-relaxed">
                {credential.notes}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Added {new Date(credential.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          {onEdit && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onEdit(credential)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => onDelete(credential.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

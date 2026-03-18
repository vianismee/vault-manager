"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, EyeOff, ExternalLink, Trash2, Edit, Globe, Key, Shield } from "lucide-react";
import { useState } from "react";
import { decrypt } from "@/lib/encryption";
import { TOTPDisplay } from "@/components/totp/totp-display";
import { toast } from "sonner";
import { Credential } from "./vault-list";
import { getFaviconUrl, generatePlaceholder } from "@/lib/icons";

interface VaultDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: Credential | null;
  onEdit?: (credential: Credential) => void;
  onDelete?: (id: string) => void;
}

export function VaultDetailSheet({
  open,
  onOpenChange,
  credential,
  onEdit,
  onDelete,
}: VaultDetailSheetProps) {
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

  const DetailButton = ({
    onClick,
    copied,
    icon: Icon,
    label,
  }: {
    onClick: () => void;
    copied?: boolean;
    icon: any;
    label: string;
  }) => (
    <button
      onClick={onClick}
      className="h-9 px-3 flex items-center gap-2 rounded-lg border border-border/60 hover:bg-muted/50 transition-colors text-sm"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 text-left">{label}</span>
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto px-0">
        {/* Header with icon */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-6 py-4">
          <SheetHeader>
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center overflow-hidden text-2xl font-semibold flex-shrink-0"
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
                    className="h-8 w-8"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  placeholder.initial
                )}
              </div>

              {/* Title info */}
              <div className="flex-1 min-w-0">
                <SheetTitle className="truncate pr-8">{credential.title}</SheetTitle>
                {credential.websiteUrl && (
                  <a
                    href={credential.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5 mt-0.5 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {new URL(credential.websiteUrl).hostname}
                  </a>
                )}
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6">
          {/* Credentials Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Key className="h-4 w-4" />
              Credentials
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Username</label>
              {credential.username ? (
                <DetailButton
                  onClick={() => handleCopy(credential.username!, "username")}
                  copied={copied === "username"}
                  icon={Globe}
                  label={credential.username}
                />
              ) : (
                <div className="text-sm text-muted-foreground italic">No username</div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Password</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-muted/50 border border-border/60 font-mono text-sm flex items-center">
                  <span className="truncate">{password}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={() => handleCopy(decrypt(credential.passwordEncrypted), "password")}
                >
                  {copied === "password" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* 2FA Section */}
          {credential.totpSecret && (
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Shield className="h-4 w-4" />
                Two-Factor Authentication
              </div>
              <TOTPDisplay secret={credential.totpSecret} />
            </div>
          )}

          {/* Notes Section */}
          {credential.notes && (
            <div className="space-y-2 pt-4 border-t border-border/40">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Notes
              </label>
              <div className="p-4 rounded-lg bg-muted/50 border border-border/60 text-sm leading-relaxed">
                {credential.notes}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t border-border/40">
            <div className="text-xs text-muted-foreground">
              Created {new Date(credential.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

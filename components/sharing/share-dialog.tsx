"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Share, Link, Mail, Check, Loader2, Eye, EyeOff, Copy } from "lucide-react";
import { encrypt } from "@/lib/encryption";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: {
    id: string;
    title: string;
    username?: string;
    passwordEncrypted: string;
    url?: string;
    totpSecret?: string;
    notes?: string;
  } | null;
}

type Permission = "view" | "edit";

export function ShareDialog({ open, onOpenChange, credential }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<Permission>("view");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [shareLink, setShareLink] = useState("");

  const handleSendInvite = async () => {
    if (!email.trim() || !credential) {
      toast.error("Please enter an email address");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if recipient exists
      const { data: recipientUser, error: lookupError } = await supabase.rpc("lookup_user_by_email", {
        email: email.trim(),
      });

      if (lookupError || !recipientUser) {
        // User doesn't exist - send invite via email
        const shareId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Create share record with pending status
        const { error: shareError } = await supabase.from("shared_credentials").insert({
          id: shareId,
          credential_id: credential.id,
          from_user_id: user.id,
          to_user_id: user.id, // Temporary - will update when recipient accepts
          to_email: email.trim(),
          permission,
          status: "pending",
          message: message || undefined,
          expires_at: expiresAt,
        });

        if (shareError) throw shareError;

        // TODO: Send email via Resend or similar
        const link = `${window.location.origin}/share/${shareId}`;
        setShareLink(link);
        setShowLink(true);

        toast.success("Share invitation created. Copy the link to send it.");
      } else {
        // User exists - create direct share
        const { error: shareError } = await supabase.from("shared_credentials").insert({
          credential_id: credential.id,
          from_user_id: user.id,
          to_user_id: recipientUser.id,
          to_email: email.trim(),
          permission,
          status: "pending",
          message: message || undefined,
          encrypted_data: credential.passwordEncrypted, // TODO: Re-encrypt with recipient's key
        });

        if (shareError) throw shareError;

        toast.success(`Password shared with ${email}`);
        onOpenChange(false);
        resetForm();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to share password");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPermission("view");
    setMessage("");
    setShowLink(false);
    setShareLink("");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    toast.success("Link copied to clipboard");
  };

  if (!credential) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Password</DialogTitle>
          <DialogDescription>
            Share &quot;{credential.title}&quot; with another person
          </DialogDescription>
        </DialogHeader>

        {!showLink ? (
          <div className="space-y-4 py-4">
            {/* Recipient Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Permission */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Permission</label>
              <div className="flex gap-2">
                <PermissionButton
                  selected={permission === "view"}
                  icon={<Eye className="h-4 w-4" />}
                  label="View only"
                  onClick={() => setPermission("view")}
                />
                <PermissionButton
                  selected={permission === "edit"}
                  icon={<EyeOff className="h-4 w-4" />}
                  label="Can edit"
                  onClick={() => setPermission("edit")}
                />
              </div>
            </div>

            {/* Message (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Message (optional)</label>
              <Input
                placeholder="Add a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-success" />
                <span>Share link created</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="text-xs font-mono"
                />
                <Button size="icon" variant="outline" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send this link to {email}. They will be able to access the shared password.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!showLink ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSendInvite} disabled={loading || !email.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Share className="h-4 w-4 mr-2" />
                )}
                Send Invite
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowLink(false)}>
                Share another
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionButton({
  selected,
  icon,
  label,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:bg-muted/50"
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

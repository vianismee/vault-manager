"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Shield, Users, Eye, EyeOff, Clock, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { decrypt } from "@/lib/encryption";
import { isMobile } from "@/lib/mobile";
import { Button } from "@/components/ui/button";

interface SharedCredential {
  id: string;
  credential_id: string;
  from_user_id: string;
  to_user_id: string;
  to_email: string;
  permission: "view" | "edit";
  status: "pending" | "accepted" | "declined" | "revoked";
  message?: string;
  created_at: string;
  expires_at: string;
  // Credential details
  title?: string;
  username?: string;
  password_encrypted?: string;
  url?: string;
  // From user details
  from_user_email?: string;
}

export default function SharedPage() {
  const router = useRouter();
  const [sharedWithMe, setSharedWithMe] = useState<SharedCredential[]>([]);
  const [sharedByMe, setSharedByMe] = useState<SharedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSharedCredentials();
  }, []);

  const fetchSharedCredentials = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      // Fetch shared with me (where I'm the recipient)
      const { data: receivedData, error: receivedError } = await supabase
        .from("shared_credentials")
        .select(`
          *,
          passwords (
            title,
            username,
            encrypted_password,
            url
          ),
          from_user:auth.users!shared_credentials_from_user_id_fkey (email)
        `)
        .eq("to_user_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch shared by me (where I'm the sender)
      const { data: sentData, error: sentError } = await supabase
        .from("shared_credentials")
        .select(`
          *,
          passwords (
            title
          )
        `)
        .eq("from_user_id", user.id)
        .order("created_at", { ascending: false });

      if (receivedError) throw receivedError;
      if (sentError) throw sentError;

      setSharedWithMe((receivedData || []).map(formatSharedCredential));
      setSharedByMe((sentData || []).map(formatSharedCredential));
    } catch (error: any) {
      toast.error(error.message || "Failed to load shared passwords");
    } finally {
      setLoading(false);
    }
  };

  const formatSharedCredential = (item: any): SharedCredential => ({
    id: item.id,
    credential_id: item.credential_id,
    from_user_id: item.from_user_id,
    to_user_id: item.to_user_id,
    to_email: item.to_email,
    permission: item.permission,
    status: item.status,
    message: item.message,
    created_at: item.created_at,
    expires_at: item.expires_at,
    title: item.passwords?.title,
    username: item.passwords?.username,
    password_encrypted: item.passwords?.encrypted_password,
    url: item.passwords?.url,
    from_user_email: item.from_user?.email,
  });

  const handleAcceptShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("shared_credentials")
        .update({ status: "accepted" })
        .eq("id", shareId);

      if (error) throw error;
      toast.success("Share accepted");
      fetchSharedCredentials();
    } catch (error: any) {
      toast.error(error.message || "Failed to accept share");
    }
  };

  const handleDeclineShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("shared_credentials")
        .update({ status: "declined" })
        .eq("id", shareId);

      if (error) throw error;
      toast.success("Share declined");
      fetchSharedCredentials();
    } catch (error: any) {
      toast.error(error.message || "Failed to decline share");
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("shared_credentials")
        .update({ status: "revoked" })
        .eq("id", shareId);

      if (error) throw error;
      toast.success("Share revoked");
      fetchSharedCredentials();
    } catch (error: any) {
      toast.error(error.message || "Failed to revoke share");
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isMobileView = isMobile();

  if (isMobileView) {
    return (
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-display text-lg">Shared</span>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <TabButton
            active
            count={sharedWithMe.length}
            onClick={() => {}}
          >
            Shared with me
          </TabButton>
          <TabButton
            count={sharedByMe.length}
            onClick={() => {}}
          >
            Shared by me
          </TabButton>
        </div>

        {/* List */}
        <div className="p-4 space-y-2">
          {sharedWithMe.length === 0 ? (
            <EmptyState message="No passwords shared with you yet" />
          ) : (
            sharedWithMe.map((item) => (
              <SharedItemCard
                key={item.id}
                item={item}
                showPassword={showPassword[item.id] || false}
                onTogglePassword={() => {
                  setShowPassword((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }));
                }}
                onAccept={() => handleAcceptShare(item.id)}
                onDecline={() => handleDeclineShare(item.id)}
                password={item.password_encrypted ? decrypt(item.password_encrypted) : ""}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex h-14 items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-lg hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-display text-lg">Shared Passwords</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 border-b border-border mb-6">
          <button className="pb-3 border-b-2 border-primary text-primary font-medium">
            Shared with me ({sharedWithMe.length})
          </button>
          <button className="pb-3 border-b-2 border-transparent text-muted-foreground hover:text-foreground">
            Shared by me ({sharedByMe.length})
          </button>
        </div>

        {/* List */}
        {sharedWithMe.length === 0 ? (
          <EmptyState message="No passwords shared with you yet" />
        ) : (
          <div className="space-y-2">
            {sharedWithMe.map((item) => (
              <SharedItemRow
                key={item.id}
                item={item}
                showPassword={showPassword[item.id] || false}
                onTogglePassword={() => {
                  setShowPassword((prev) => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }));
                }}
                onAccept={() => handleAcceptShare(item.id)}
                onDecline={() => handleDeclineShare(item.id)}
                onRevoke={() => handleRevokeShare(item.id)}
                password={item.password_encrypted ? decrypt(item.password_encrypted) : ""}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <span className="px-2 py-0.5 text-xs bg-warning/20 text-warning rounded-full">Pending</span>;
    case "accepted":
      return <span className="px-2 py-0.5 text-xs bg-success/20 text-success rounded-full">Accepted</span>;
    case "declined":
      return <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">Declined</span>;
    case "revoked":
      return <span className="px-2 py-0.5 text-xs bg-destructive/20 text-destructive rounded-full">Revoked</span>;
    default:
      return null;
  }
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active?: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-center border-b-2 transition-colors ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground"
      }`}
    >
      <span className="text-sm font-medium">{children}</span>
      {count > 0 && <span className="ml-1 text-xs">({count})</span>}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function SharedItemCard({
  item,
  showPassword,
  onTogglePassword,
  onAccept,
  onDecline,
  password,
}: {
  item: SharedCredential;
  showPassword: boolean;
  onTogglePassword: () => void;
  onAccept: () => void;
  onDecline: () => void;
  password: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{item.title || "Shared Password"}</h3>
          {item.from_user_email && (
            <p className="text-sm text-muted-foreground">From {item.from_user_email}</p>
          )}
        </div>
        {getStatusBadge(item.status)}
      </div>

      {item.status === "accepted" && (
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
          <span className="font-mono text-sm">{showPassword ? password : "••••••••"}</span>
          <button onClick={onTogglePassword} className="p-1">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      )}

      {item.status === "pending" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={onAccept} className="flex-1">
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={onDecline} className="flex-1">
            <X className="h-4 w-4 mr-1" />
            Decline
          </Button>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Expires {new Date(item.expires_at).toLocaleDateString()}
      </div>
    </div>
  );
}

function SharedItemRow({
  item,
  showPassword,
  onTogglePassword,
  onAccept,
  onDecline,
  onRevoke,
  password,
}: {
  item: SharedCredential;
  showPassword: boolean;
  onTogglePassword: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onRevoke: () => void;
  password: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-medium">{item.title || "Shared Password"}</h3>
            {getStatusBadge(item.status)}
          </div>
          {item.from_user_email && (
            <p className="text-sm text-muted-foreground mt-1">From {item.from_user_email}</p>
          )}
          {item.to_email && (
            <p className="text-sm text-muted-foreground mt-1">To {item.to_email}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              {item.permission === "view" ? "View only" : "Can edit"}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              Expires {new Date(item.expires_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.status === "accepted" && (
            <>
              <span className="font-mono text-sm text-muted-foreground">
                {showPassword ? password : "••••••••"}
              </span>
              <button onClick={onTogglePassword} className="p-2 hover:bg-muted rounded-lg">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </>
          )}
          {item.status === "pending" && (
            <>
              <Button size="sm" onClick={onAccept}>
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={onDecline}>
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

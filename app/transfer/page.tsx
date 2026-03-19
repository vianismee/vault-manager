"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Shield, Mail, Loader2, Check, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isMobile } from "@/lib/mobile";

interface Transfer {
  id: string;
  from_user_id: string;
  to_email: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  message?: string;
  created_at: string;
  expires_at: string;
}

export default function TransferPage() {
  const router = useRouter();
  const [step, setStep] = useState<"initiate" | "pending" | "success">("initiate");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [transferId, setTransferId] = useState("");
  const [incomingTransfers, setIncomingTransfers] = useState<Transfer[]>([]);
  const [showIncoming, setShowIncoming] = useState(false);

  useEffect(() => {
    checkIncomingTransfers();
  }, []);

  const checkIncomingTransfers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("account_transfers")
        .select("*")
        .eq("to_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        setIncomingTransfers(data as any as Transfer[]);
        setShowIncoming(true);
      }
    } catch (error) {
      console.error("Failed to check transfers:", error);
    }
  };

  const initiateTransfer = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch all credentials
      const { data: credentials, error: credError } = await supabase
        .from("passwords")
        .select("*")
        .eq("user_id", user.id);

      if (credError) throw credError;

      // Create transfer with encrypted data
      const transferData = JSON.stringify({
        credentials: credentials || [],
        exportedAt: new Date().toISOString(),
      });

      const { data: transfer, error: transferError } = await supabase
        .from("account_transfers")
        .insert({
          from_user_id: user.id,
          to_email: email.trim(),
          encrypted_data: transferData, // TODO: Encrypt with recipient's public key
          status: "pending",
          message: message || undefined,
        })
        .select()
        .single();

      if (transferError) throw transferError;

      setTransferId(transfer.id);
      setStep("pending");
      toast.success("Transfer initiated");
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate transfer");
    } finally {
      setLoading(false);
    }
  };

  const acceptTransfer = async (transfer: Transfer) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the transfer details
      const { data: transferData, error: fetchError } = await supabase
        .from("account_transfers")
        .select("*")
        .eq("id", transfer.id)
        .single();

      if (fetchError) throw fetchError;

      // Parse and import credentials
      const importData = JSON.parse(transferData.encrypted_data);

      // Import all credentials
      for (const cred of importData.credentials || []) {
        await supabase.from("passwords").insert({
          user_id: user.id,
          title: cred.title,
          username: cred.username,
          encrypted_password: cred.encrypted_password,
          url: cred.url,
          notes: cred.notes,
          totp_secret: cred.totp_secret,
          category_id: cred.category_id,
        });
      }

      // Update transfer status
      await supabase
        .from("account_transfers")
        .update({ status: "accepted", to_user_id: user.id })
        .eq("id", transfer.id);

      toast.success("Vault transfer completed successfully");
      setIncomingTransfers(incomingTransfers.filter((t) => t.id !== transfer.id));
      if (incomingTransfers.length === 1) {
        setShowIncoming(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to accept transfer");
    } finally {
      setLoading(false);
    }
  };

  const declineTransfer = async (transferId: string) => {
    try {
      await supabase
        .from("account_transfers")
        .update({ status: "declined" })
        .eq("id", transferId);

      toast.success("Transfer declined");
      setIncomingTransfers(incomingTransfers.filter((t) => t.id !== transferId));
      if (incomingTransfers.length === 1) {
        setShowIncoming(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to decline transfer");
    }
  };

  if (showIncoming && incomingTransfers.length > 0) {
    return <IncomingTransferView transfers={incomingTransfers} onAccept={acceptTransfer} onDecline={declineTransfer} loading={loading} />;
  }

  if (step === "pending") {
    return <PendingTransferView transferId={transferId} email={email} />;
  }

  const isMobileView = isMobile();

  return (
    <div className="min-h-screen bg-background">
      {isMobileView ? (
        <MobileInitiateView
          email={email}
          message={message}
          loading={loading}
          onEmailChange={setEmail}
          onMessageChange={setMessage}
          onSubmit={initiateTransfer}
          onBack={() => router.back()}
        />
      ) : (
        <DesktopInitiateView
          email={email}
          message={message}
          loading={loading}
          onEmailChange={setEmail}
          onMessageChange={setMessage}
          onSubmit={initiateTransfer}
          onBack={() => router.back()}
        />
      )}
    </div>
  );
}

function MobileInitiateView({
  email,
  message,
  loading,
  onEmailChange,
  onMessageChange,
  onSubmit,
  onBack,
}: {
  email: string;
  message: string;
  loading: boolean;
  onEmailChange: (e: string) => void;
  onMessageChange: (e: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-muted">
          <ArrowRight className="h-5 w-5 rotate-180" />
        </button>
        <span className="font-display text-lg">Transfer Vault</span>
      </header>

      <div className="p-6 space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-display mb-2">Transfer Your Vault</h2>
          <p className="text-sm text-muted-foreground">
            Transfer all your passwords to another email address
          </p>
        </div>

        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
          <div className="flex gap-2 text-sm">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-warning">
              This will transfer ALL your passwords. Make sure you trust the recipient.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Recipient email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message (optional)</label>
            <Input
              placeholder="Add a message for the recipient"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
            />
          </div>

          <Button
            onClick={onSubmit}
            disabled={loading || !email.trim()}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Initiate Transfer
          </Button>
        </div>
      </div>
    </div>
  );
}

function DesktopInitiateView({
  email,
  message,
  loading,
  onEmailChange,
  onMessageChange,
  onSubmit,
  onBack,
}: {
  email: string;
  message: string;
  loading: boolean;
  onEmailChange: (e: string) => void;
  onMessageChange: (e: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="max-w-lg mx-auto px-6">
          <div className="flex h-14 items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-muted">
              <ArrowRight className="h-5 w-5 rotate-180" />
            </button>
            <span className="font-display text-lg">Transfer Vault</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-display mb-2">Transfer Your Vault</h2>
          <p className="text-muted-foreground">
            Transfer all your passwords to another email address
          </p>
        </div>

        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">
              <strong>Warning:</strong> This will transfer ALL your passwords to the recipient.
              Make sure you trust them and have their correct email address.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Recipient email</label>
            <Input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Message (optional)</label>
            <Input
              placeholder="Add a message for the recipient"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
            />
          </div>

          <Button
            onClick={onSubmit}
            disabled={loading || !email.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Initiate Transfer
          </Button>
        </div>
      </main>
    </div>
  );
}

function PendingTransferView({ transferId, email }: { transferId: string; email: string }) {
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/transfer/${transferId}` : "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-xl font-display mb-2">Transfer Initiated</h2>
        <p className="text-muted-foreground mb-6">
          Share this link with {email} to complete the transfer
        </p>
        <div className="bg-muted/50 rounded-xl p-4 mb-4">
          <input
            type="text"
            value={shareLink}
            readOnly
            className="w-full bg-transparent text-sm font-mono text-center"
          />
        </div>
        <Button
          onClick={() => navigator.clipboard.writeText(shareLink)}
          variant="outline"
          className="w-full"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy Transfer Link
        </Button>
      </div>
    </div>
  );
}

function IncomingTransferView({
  transfers,
  onAccept,
  onDecline,
  loading,
}: {
  transfers: Transfer[];
  onAccept: (transfer: Transfer) => void;
  onDecline: (id: string) => void;
  loading: boolean;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-muted">
          <ArrowRight className="h-5 w-5 rotate-180" />
        </button>
        <span className="font-display text-lg">Incoming Transfer</span>
      </header>

      <div className="p-6 space-y-4">
        {transfers.map((transfer) => (
          <div key={transfer.id} className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-medium">Vault Transfer</h3>
                <p className="text-sm text-muted-foreground">From {transfer.to_email}</p>
              </div>
            </div>

            {transfer.message && (
              <p className="text-sm text-muted-foreground italic">&quot;{transfer.message}&quot;</p>
            )}

            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <p className="text-sm text-warning">
                Accepting this transfer will add all passwords to your vault.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => onAccept(transfer)}
                disabled={loading}
                className="flex-1"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Accept
              </Button>
              <Button
                onClick={() => onDecline(transfer.id)}
                variant="outline"
                disabled={loading}
                className="flex-1"
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

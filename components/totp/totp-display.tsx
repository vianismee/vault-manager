"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useTOTP } from "@/hooks/use-totp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TOTPDisplayProps {
  secret: string;
}

export function TOTPDisplay({ secret }: TOTPDisplayProps) {
  const { token, remaining, isLoading } = useTOTP(secret);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success("OTP copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (remaining / 30) * circumference;
  const isWarning = remaining <= 10;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-28">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Circular countdown */}
      <div className="relative flex-shrink-0">
        <svg className="h-20 w-20 transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-muted/20"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className={cn(
              "transition-colors duration-300",
              isWarning ? "text-destructive" : "text-primary"
            )}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium tabular-nums">{remaining}</span>
        </div>
      </div>

      {/* TOTP token */}
      <button
        onClick={handleCopy}
        className="flex-1 flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 border border-border/60 hover:bg-muted/70 transition-colors group"
      >
        <span className="text-2xl font-mono tracking-wider tabular-nums">
          {token?.match(/.{1,3}/g)?.join(" ") || "------"}
        </span>
        {copied ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>
    </div>
  );
}

"use client";

import { Copy, Check, ChevronRight, Key } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getFaviconUrl, generatePlaceholder } from "@/lib/icons";

interface VaultItemProps {
  id: string;
  title: string;
  username?: string;
  websiteUrl?: string;
  category: string;
  totpSecret?: string;
  onClick: () => void;
  index: number;
}

export function VaultItem({
  title,
  username,
  websiteUrl,
  totpSecret,
  onClick,
  index,
}: VaultItemProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleCopyUsername = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (username) {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      toast.success("Username copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  const faviconUrl = websiteUrl && !imgError ? getFaviconUrl(websiteUrl) : null;
  const placeholder = generatePlaceholder(title);

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className="group flex items-center gap-4 py-3.5 px-4 hover:bg-muted/50 transition-colors cursor-pointer"
      style={{ animation: `fadeIn 0.2s ease-out ${index * 0.03}s both` }}
    >
      {/* Icon */}
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden text-sm font-semibold"
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
            className="h-6 w-6"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          placeholder.initial
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{title}</div>
        {username && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground truncate">
              {username}
            </span>
          </div>
        )}
      </div>

      {/* 2FA indicator */}
      {totpSecret && (
        <div className="flex-shrink-0">
          <Key className="h-4 w-4 text-muted-foreground/40" />
        </div>
      )}

      {/* Copy button */}
      {username && (
        <button
          onClick={handleCopyUsername}
          className="flex-shrink-0 p-2 -m-2 hover:bg-muted rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Copy username"
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}

      {/* Chevron */}
      <ChevronRight className="h-5 w-5 text-muted-foreground/20 flex-shrink-0" />
    </div>
  );
}

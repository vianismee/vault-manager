"use client";

import { VaultItem } from "./vault-item";

export interface Credential {
  id: string;
  title: string;
  username?: string;
  /** Plaintext password decrypted from chain replay (new system). */
  password?: string;
  /** Legacy CryptoJS-encrypted password (old system, kept for backward compat). */
  passwordEncrypted: string;
  websiteUrl?: string;
  totpSecret?: string;
  notes?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultListProps {
  credentials: Credential[];
  onSelectCredential: (credential: Credential) => void;
}

export function VaultList({ credentials, onSelectCredential }: VaultListProps) {
  if (credentials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <svg className="h-7 w-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-display mb-1">No results found</h3>
        <p className="text-muted-foreground text-sm">
          Try adjusting your search query
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
      {credentials.map((credential, index) => (
        <VaultItem
          key={credential.id}
          {...credential}
          username={credential.username}
          websiteUrl={credential.websiteUrl}
          onClick={() => onSelectCredential(credential)}
          index={index}
        />
      ))}
    </div>
  );
}

"use client";

/**
 * vault-context.tsx — In-memory vault key store with session guard integration.
 * REQ-006, REQ-007, REQ-011, REQ-013
 *
 * Holds the active vault CryptoKey and Ed25519 private key in memory only.
 * Keys are zeroed and nullified on lock.
 *
 * Unlock methods:
 *  - unlockWithPin(pin): Decrypts vault key from IndexedDB via PIN
 *  - unlock(seedphrase): Full key derivation from seedphrase (recovery)
 */

import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { mnemonicToMasterSeed } from "@/lib/crypto/seedphrase";
import { deriveVaultKey, deriveIdentityKey } from "@/lib/crypto/hd-keys";
import { deriveEd25519Keypair } from "@/lib/crypto/keypair";
import { importAesKey } from "@/lib/crypto/block-cipher";
import { createSessionGuard, type SessionGuard } from "@/lib/crypto/session-guard";
import {
  unwrapVaultKeyWithPin,
  unwrapPrivateKeyWithPin,
  wrapVaultKeyWithPin,
  wrapPrivateKeyWithPin,
  isDeviceSetup,
} from "@/lib/crypto/secure-enclave";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface VaultIdentity {
  chainId: string;
  publicKey: Uint8Array; // Ed25519 public key (hex = vault address)
}

export interface VaultContextValue {
  /** Non-extractable AES-256-GCM vault key (null when locked) */
  vaultKey: CryptoKey | null;
  /** Ed25519 private key for block signing (null when locked) */
  privateKey: Uint8Array | null;
  /** Ed25519 public key (null when locked) */
  publicKey: Uint8Array | null;
  /** Supabase vault chain ID (null when locked) */
  chainId: string | null;
  /** True if vault is locked (no keys in memory) */
  isLocked: boolean;
  /** True while deriving keys */
  isUnlocking: boolean;
  /** Whether device has a PIN-wrapped key stored */
  hasDevicePin: boolean | null;
  /**
   * Unlock vault by deriving keys from seedphrase (recovery).
   * Fetches chainId from Supabase vault_chains.
   */
  unlock: (seedphrase: string) => Promise<void>;
  /**
   * Unlock vault using PIN (daily unlock).
   * Decrypts vault key from IndexedDB, then fetches chain metadata.
   */
  unlockWithPin: (pin: string) => Promise<void>;
  /**
   * Unlock vault from seedphrase AND register a PIN for this device.
   * Used when logging in on a new device — wraps the vault key with PIN
   * before importing it as non-extractable, so future unlocks can use PIN.
   */
  unlockWithSeedphraseAndPin: (seedphrase: string, pin: string) => Promise<void>;
  /**
   * Lock vault: zero private key bytes, nullify all key references, stop session guard.
   */
  lock: () => void;
  /** Schedule clipboard auto-clear after 30 seconds (REQ-014) */
  scheduleClipboardClear: () => void;
  /** Session guard instance (for Ctrl+Shift+L keybinding etc.) */
  sessionGuard: SessionGuard | null;
}

// ────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside VaultProvider");
  return ctx;
}

// ────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [privateKey, setPrivateKey] = useState<Uint8Array | null>(null);
  const [publicKey, setPublicKey] = useState<Uint8Array | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [hasDevicePin, setHasDevicePin] = useState<boolean | null>(null);

  // Keep ref to private key for cleanup on lock
  const privateKeyRef = useRef<Uint8Array | null>(null);
  const sessionGuardRef = useRef<SessionGuard | null>(null);

  // Check device PIN status on mount
  useEffect(() => {
    isDeviceSetup().then((setup) => setHasDevicePin(setup));
  }, []);

  // ── Lock ────────────────────────────────────────────────
  const lock = useCallback(() => {
    // Zero private key bytes (SEC-004)
    if (privateKeyRef.current) {
      privateKeyRef.current.fill(0);
      privateKeyRef.current = null;
    }
    // Stop session guard
    sessionGuardRef.current?.stop();
    sessionGuardRef.current = null;

    setVaultKey(null);
    setPrivateKey(null);
    setPublicKey(null);
    setChainId(null);
    setIsLocked(true);
  }, []);

  // ── Unlock with seedphrase (recovery) ───────────────────
  const unlock = useCallback(async (seedphrase: string) => {
    setIsUnlocking(true);
    try {
      // 1. Derive master seed
      const masterSeed = await mnemonicToMasterSeed(seedphrase);

      // 2. Derive vault key raw bytes
      const vaultKeyRaw = deriveVaultKey(masterSeed);
      const identitySeed = deriveIdentityKey(masterSeed);

      // 3. Zero master seed immediately (SEC-004)
      masterSeed.fill(0);

      // 4. Derive Ed25519 keypair
      const { privateKey: privKey, publicKey: pubKey } = deriveEd25519Keypair(identitySeed);
      identitySeed.fill(0);

      // 5. Import vault key as non-extractable CryptoKey
      // Note: importAesKey zeros vaultKeyRaw internally (SEC-004)
      const aesKey = await importAesKey(vaultKeyRaw);

      // 6. Fetch chainId from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: chain } = await supabase
        .from("vault_chains")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!chain) throw new Error("Vault chain not found — complete onboarding first");

      // 7. Store in state
      privateKeyRef.current = privKey;
      setVaultKey(aesKey);
      setPrivateKey(privKey);
      setPublicKey(pubKey);
      setChainId(chain.id);
      setIsLocked(false);

      // 8. Start session guard
      const guard = createSessionGuard({ onLock: lock });
      guard.start(aesKey);
      sessionGuardRef.current = guard;
    } finally {
      setIsUnlocking(false);
    }
  }, [lock]);

  // ── Unlock with PIN (daily) ─────────────────────────────
  const unlockWithPin = useCallback(async (pin: string) => {
    setIsUnlocking(true);
    try {
      // 1. Decrypt vault key + private key from IndexedDB using PIN
      const [aesKey, privKey] = await Promise.all([
        unwrapVaultKeyWithPin(pin),
        unwrapPrivateKeyWithPin(pin),
      ]);

      // 2. Fetch chain metadata from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: chain } = await supabase
        .from("vault_chains")
        .select("id, public_key")
        .eq("user_id", user.id)
        .single();

      if (!chain) throw new Error("Vault chain not found — complete onboarding first");

      // 3. Reconstruct public key from stored hex
      const pubKeyHex = chain.public_key as string;
      const pubKeyBytes = new Uint8Array(
        pubKeyHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
      );

      // 4. Store in state (privKey may be null for pre-upgrade devices — handled gracefully)
      privateKeyRef.current = privKey;
      setVaultKey(aesKey);
      setPrivateKey(privKey);
      setPublicKey(pubKeyBytes);
      setChainId(chain.id);
      setIsLocked(false);

      // 5. Start session guard
      const guard = createSessionGuard({ onLock: lock });
      guard.start(aesKey);
      sessionGuardRef.current = guard;
    } finally {
      setIsUnlocking(false);
    }
  }, [lock]);

  // ── Unlock with seedphrase + register PIN (new device) ──
  const unlockWithSeedphraseAndPin = useCallback(async (seedphrase: string, pin: string) => {
    setIsUnlocking(true);
    try {
      // 1. Derive master seed
      const masterSeed = await mnemonicToMasterSeed(seedphrase);
      const vaultKeyRaw = deriveVaultKey(masterSeed);
      const identitySeed = deriveIdentityKey(masterSeed);
      masterSeed.fill(0);

      // 2. Derive Ed25519 keypair
      const { privateKey: privKey, publicKey: pubKey } = deriveEd25519Keypair(identitySeed);
      identitySeed.fill(0);

      // 3. Verify seedphrase matches stored public key
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: chain } = await supabase
        .from("vault_chains")
        .select("id, public_key")
        .eq("user_id", user.id)
        .single();

      if (!chain) throw new Error("Vault chain not found — complete onboarding first");

      const derivedPubHex = Array.from(pubKey, (b: number) => b.toString(16).padStart(2, "0")).join("");
      if ((chain.public_key as string) !== derivedPubHex) {
        privKey.fill(0);
        throw new Error("Incorrect seedphrase — keys do not match");
      }

      // 4. Wrap vault key + private key with PIN BEFORE importing as non-extractable (SEC-004)
      await wrapVaultKeyWithPin(new Uint8Array(vaultKeyRaw), pin);
      await wrapPrivateKeyWithPin(privKey, pin);

      // 5. Import vault key as non-extractable CryptoKey (zeros vaultKeyRaw)
      const aesKey = await importAesKey(vaultKeyRaw);

      // 6. Store in state
      privateKeyRef.current = privKey;
      setVaultKey(aesKey);
      setPrivateKey(privKey);
      setPublicKey(pubKey);
      setChainId(chain.id);
      setIsLocked(false);
      setHasDevicePin(true);

      // 7. Start session guard
      const guard = createSessionGuard({ onLock: lock });
      guard.start(aesKey);
      sessionGuardRef.current = guard;
    } finally {
      setIsUnlocking(false);
    }
  }, [lock]);

  // ── Clipboard clear ─────────────────────────────────────
  const scheduleClipboardClear = useCallback(() => {
    sessionGuardRef.current?.scheduleClipboardClear();
  }, []);

  // ── Ctrl+Shift+L keyboard shortcut ──────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        lock();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lock]);

  // ── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (privateKeyRef.current) privateKeyRef.current.fill(0);
      sessionGuardRef.current?.stop();
    };
  }, []);

  return (
    <VaultContext.Provider
      value={{
        vaultKey,
        privateKey,
        publicKey,
        chainId,
        isLocked,
        isUnlocking,
        hasDevicePin,
        unlock,
        unlockWithPin,
        unlockWithSeedphraseAndPin,
        lock,
        scheduleClipboardClear,
        sessionGuard: sessionGuardRef.current,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

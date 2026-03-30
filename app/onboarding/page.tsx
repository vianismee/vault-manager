"use client";

/**
 * Onboarding page — Seedphrase generation, confirmation, PIN setup, and vault chain creation.
 * TASK-016
 *
 * Steps:
 *  1. Choose word count (12 or 24)
 *  2. Display generated seedphrase — user must acknowledge backup
 *  3. Confirm 3 randomly selected words
 *  4. Setup PIN for daily unlock
 *  5. Create Genesis Block + vault_chains record + wrap key with PIN
 *  6. Redirect to /migrate (if legacy credentials exist) or /vault
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Copy, Check, ChevronRight, Loader2, AlertTriangle, Eye, EyeOff, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  generateMnemonic,
  mnemonicToWords,
  mnemonicToMasterSeed,
  pickConfirmationIndices,
  type WordCount,
} from "@/lib/crypto/seedphrase";
import { deriveVaultKey, deriveIdentityKey } from "@/lib/crypto/hd-keys";
import { deriveEd25519Keypair } from "@/lib/crypto/keypair";
import { importAesKey } from "@/lib/crypto/block-cipher";
import { createGenesisBlock } from "@/lib/crypto/chain";
import { wrapVaultKeyWithPin } from "@/lib/crypto/secure-enclave";
import { countLegacyCredentials } from "@/lib/migration/migrate-vault";

type Step = "word-count" | "display" | "confirm" | "pin" | "securing" | "done";

const SLIDE = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

const PIN_MIN_LENGTH = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("word-count");
  const [wordCount, setWordCount] = useState<WordCount>(24);
  const [mnemonic, setMnemonic] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const [showWords, setShowWords] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [confirmInputs, setConfirmInputs] = useState<Record<number, string>>({});
  const [confirmError, setConfirmError] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // PIN state
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPin, setShowPin] = useState(false);

  // Generate seedphrase when user picks word count
  const generateNew = useCallback((wc: WordCount) => {
    const m = generateMnemonic(wc);
    setMnemonic(m);
    setWords(mnemonicToWords(m));
    setShowWords(false);
    setConfirmed(false);
  }, []);

  useEffect(() => {
    if (step === "display") {
      generateNew(wordCount);
      setConfirmIndices(pickConfirmationIndices(mnemonic || generateMnemonic(wordCount)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Step 1: Word count ──────────────────────────────────
  function handleChooseWordCount(wc: WordCount) {
    setWordCount(wc);
    generateNew(wc);
    setStep("display");
  }

  // ── Step 2: Copy seedphrase ─────────────────────────────
  async function handleCopy() {
    await navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleConfirmBackup() {
    const indices = pickConfirmationIndices(mnemonic, 3);
    setConfirmIndices(indices);
    setConfirmInputs({});
    setConfirmError("");
    setStep("confirm");
  }

  // ── Step 3: Confirm words ───────────────────────────────
  function handleConfirmSubmit() {
    const w = mnemonicToWords(mnemonic);
    for (const idx of confirmIndices) {
      const entered = (confirmInputs[idx] ?? "").trim().toLowerCase();
      if (entered !== w[idx].toLowerCase()) {
        setConfirmError(
          `Word #${idx + 1} is incorrect. Make sure you have your seedphrase backed up.`
        );
        return;
      }
    }
    setConfirmError("");
    setPin("");
    setPinConfirm("");
    setPinError("");
    setStep("pin");
  }

  // ── Step 4: PIN setup ───────────────────────────────────
  function handlePinSubmit() {
    if (pin.length < PIN_MIN_LENGTH) {
      setPinError(`PIN must be at least ${PIN_MIN_LENGTH} characters`);
      return;
    }
    if (pin !== pinConfirm) {
      setPinError("PINs do not match");
      return;
    }
    setPinError("");
    handleCreateVault();
  }

  // ── Step 5: Create vault chain ──────────────────────────
  async function handleCreateVault() {
    setStep("securing");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Derive keys from seedphrase
      const masterSeed = await mnemonicToMasterSeed(mnemonic);
      const vaultKeyRaw = deriveVaultKey(masterSeed);
      const identitySeed = deriveIdentityKey(masterSeed);
      masterSeed.fill(0);

      const { privateKey, publicKey } = deriveEd25519Keypair(identitySeed);
      identitySeed.fill(0);

      // Wrap vault key with PIN and store in IndexedDB (before importAesKey zeros the raw bytes)
      await wrapVaultKeyWithPin(new Uint8Array(vaultKeyRaw), pin);

      // Import vault key as non-extractable CryptoKey
      const vaultKey = await importAesKey(vaultKeyRaw); // zeros vaultKeyRaw

      // Create vault_chains record + store public key
      const pubKeyHex = Array.from(publicKey, (b) => b.toString(16).padStart(2, "0")).join("");

      const { data: chain, error: chainError } = await supabase
        .from("vault_chains")
        .insert({
          user_id: user.id,
          public_key: pubKeyHex,
          status: "active",
          migration_status: "none",
          migrated_from_legacy: false,
        })
        .select("id")
        .single();

      if (chainError) throw chainError;

      // Create Genesis Block (vaultId = chain.id)
      const genesis = await createGenesisBlock(vaultKey, privateKey, chain.id);

      const { error: blockError } = await supabase.from("chain_blocks").insert({
        chain_id: chain.id,
        block_index: genesis.block_index,
        prev_hash: genesis.prev_hash,
        timestamp: genesis.timestamp,
        nonce: genesis.nonce,
        payload: genesis.payload,
        block_hash: genesis.block_hash,
        signature: genesis.signature,
      });

      if (blockError) throw blockError;

      // Zero private key
      privateKey.fill(0);

      // Check for legacy credentials → migrate or go to vault
      const legacyCount = await countLegacyCredentials(supabase, user.id);
      if (legacyCount > 0) {
        router.replace("/migrate");
      } else {
        router.replace("/vault");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Vault creation failed";
      console.error("[onboarding] Vault creation failed:", err);
      toast.error(`Vault creation failed: ${msg}`);
      setStep("pin");
    } finally {
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-12">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-display text-lg">Vault</span>
      </div>

      <div className="w-full max-w-[480px]">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Word count ─────────────────────── */}
          {step === "word-count" && (
            <motion.div key="word-count" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}>
              <div className="text-center mb-8">
                <h1 className="font-display text-2xl mb-2">Set up your vault</h1>
                <p className="font-accent text-[15px] text-muted-foreground">
                  Choose your seedphrase length. This is the <strong>only way</strong> to access and recover your vault.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {([12, 24] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => handleChooseWordCount(n)}
                    className="surface-card p-5 text-left hover:border-primary/40 transition-colors group"
                  >
                    <p className="font-display text-3xl text-primary mb-1">{n}</p>
                    <p className="font-accent text-sm font-semibold mb-0.5">words</p>
                    <p className="font-accent text-xs text-muted-foreground">
                      {n === 12 ? "128-bit entropy — standard security" : "256-bit entropy — maximum security"}
                    </p>
                  </button>
                ))}
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="font-accent text-xs text-amber-700 dark:text-amber-400">
                  Your seedphrase is the only key to your vault. If you lose it, your data cannot be recovered. Write it down on paper and store it safely.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Display seedphrase ─────────────── */}
          {step === "display" && (
            <motion.div key="display" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}>
              <div className="text-center mb-6">
                <h1 className="font-display text-2xl mb-2">Your recovery seedphrase</h1>
                <p className="font-accent text-[15px] text-muted-foreground">
                  Write these {wordCount} words down in order. Never share them with anyone.
                </p>
              </div>

              <div className="surface-card p-5 mb-4 relative">
                <div className={`grid grid-cols-3 gap-2 ${!showWords ? "blur-sm select-none pointer-events-none" : ""}`}>
                  {words.map((word, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1.5">
                      <span className="font-accent text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <span className="font-accent text-sm font-medium">{word}</span>
                    </div>
                  ))}
                </div>
                {!showWords && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                    <button
                      onClick={() => setShowWords(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-background/90 border border-border rounded-lg font-accent text-sm font-medium shadow-sm"
                    >
                      <Eye className="h-4 w-4" />
                      Reveal seedphrase
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowWords((v) => !v)}
                >
                  {showWords ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                  {showWords ? "Hide" : "Show"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCopy}
                  disabled={!showWords}
                >
                  {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateNew(wordCount)}
                  title="Generate new seedphrase"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mb-6">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span className="font-accent text-sm text-muted-foreground leading-snug">
                  I have written down my seedphrase and stored it in a safe place. I understand that losing it means permanent loss of access.
                </span>
              </label>

              <Button
                className="w-full btn-primary"
                disabled={!confirmed || !showWords}
                onClick={handleConfirmBackup}
              >
                I've saved my seedphrase
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 3: Confirm words ───────────────────── */}
          {step === "confirm" && (
            <motion.div key="confirm" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}>
              <div className="text-center mb-6">
                <h1 className="font-display text-2xl mb-2">Verify your backup</h1>
                <p className="font-accent text-[15px] text-muted-foreground">
                  Enter the words at positions {confirmIndices.map((i) => `#${i + 1}`).join(", ")} to confirm you've saved your seedphrase.
                </p>
              </div>

              <div className="surface-card p-5 space-y-4 mb-4">
                {confirmIndices.map((idx) => (
                  <div key={idx}>
                    <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                      Word #{idx + 1}
                    </label>
                    <Input
                      type="text"
                      placeholder={`Enter word #${idx + 1}`}
                      value={confirmInputs[idx] ?? ""}
                      onChange={(e) =>
                        setConfirmInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      className="input-refined"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>

              {confirmError && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="font-accent text-sm text-destructive">{confirmError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("display")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 btn-primary"
                  onClick={handleConfirmSubmit}
                  disabled={confirmIndices.some((i) => !(confirmInputs[i] ?? "").trim())}
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: PIN setup ───────────────────────── */}
          {step === "pin" && (
            <motion.div key="pin" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}>
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <h1 className="font-display text-2xl mb-2">Set your PIN</h1>
                <p className="font-accent text-[15px] text-muted-foreground">
                  This PIN will be used to unlock your vault daily. Don&apos;t lose your seedphrase — it&apos;s the only way to recover if you forget your PIN.
                </p>
              </div>

              <div className="surface-card p-5 space-y-4 mb-4">
                <div>
                  <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                    Create PIN
                  </label>
                  <div className="relative">
                    <Input
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      placeholder="Enter PIN"
                      value={pin}
                      onChange={(e) => { setPin(e.target.value); setPinError(""); }}
                      className="input-refined pr-10 text-center text-lg tracking-[0.3em]"
                      autoComplete="off"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPin((v) => !v)}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                    Confirm PIN
                  </label>
                  <Input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    placeholder="Re-enter PIN"
                    value={pinConfirm}
                    onChange={(e) => { setPinConfirm(e.target.value); setPinError(""); }}
                    className="input-refined text-center text-lg tracking-[0.3em]"
                    autoComplete="off"
                  />
                </div>
              </div>

              {pinError && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="font-accent text-sm text-destructive">{pinError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("confirm")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 btn-primary"
                  onClick={handlePinSubmit}
                  disabled={pin.length < PIN_MIN_LENGTH || pinConfirm.length < PIN_MIN_LENGTH}
                >
                  Create vault
                  <ChevronRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 5: Securing ────────────────────────── */}
          {step === "securing" && (
            <motion.div key="securing" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h2 className="font-display text-xl mb-2">Creating your vault</h2>
              <p className="font-accent text-[15px] text-muted-foreground">
                Deriving cryptographic keys and initialising the credential chain…
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Step indicator */}
      {step !== "securing" && step !== "done" && (
        <div className="flex gap-1.5 mt-8">
          {(["word-count", "display", "confirm", "pin"] as const).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                step === s ? "w-6 bg-primary" : i < ["word-count","display","confirm","pin"].indexOf(step) ? "w-3 bg-primary/40" : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

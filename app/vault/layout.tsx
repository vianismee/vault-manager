"use client";

/**
 * Vault layout — wraps all /vault/* routes with VaultProvider and lock screen.
 * TASK-019
 *
 * Unlock methods:
 *  - PIN (default): decrypts vault key from IndexedDB
 *  - Seedphrase (recovery): full key derivation
 */

import { VaultProvider, useVault } from "@/contexts/vault-context";
import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Loader2, Eye, EyeOff, ArrowLeft, Key, Smartphone, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

// ── Lock screen ─────────────────────────────────────────────

type UnlockMode = "pin" | "seedphrase" | "new-device" | "forgot-pin";
type NewDeviceStep = "seedphrase" | "pin";

function LockScreen() {
  const { unlock, unlockWithPin, unlockWithSeedphraseAndPin, isUnlocking, hasDevicePin } = useVault();
  const router = useRouter();

  const [mode, setMode] = useState<UnlockMode>("pin");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [seedphrase, setSeedphrase] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [error, setError] = useState("");

  // New-device flow state
  const [newDeviceStep, setNewDeviceStep] = useState<NewDeviceStep>("seedphrase");
  const [newDevicePin, setNewDevicePin] = useState("");
  const [newDevicePinConfirm, setNewDevicePinConfirm] = useState("");
  const [showNewDevicePin, setShowNewDevicePin] = useState(false);

  // Switch to new-device mode when this device has no stored key
  useEffect(() => {
    if (hasDevicePin === false) {
      setMode("new-device");
    }
  }, [hasDevicePin]);

  // ── PIN unlock ────────────────────────────────────────
  async function handlePinUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await unlockWithPin(pin);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Incorrect PIN");
      setPin("");
    }
  }

  // ── Seedphrase unlock (recovery) ──────────────────────
  async function handleSeedphraseUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await unlock(seedphrase.trim().toLowerCase());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unlock failed — check your seedphrase");
    }
  }

  // ── New device: seedphrase → PIN registration ─────────
  function handleNewDeviceSeedphraseNext(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const wordCount = seedphrase.trim().split(/\s+/).length;
    if (wordCount !== 12 && wordCount !== 24) {
      setError("Seedphrase must be 12 or 24 words");
      return;
    }
    setNewDevicePin("");
    setNewDevicePinConfirm("");
    setNewDeviceStep("pin");
  }

  async function handleNewDevicePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newDevicePin.length < 4) {
      setError("PIN must be at least 4 characters");
      return;
    }
    if (newDevicePin !== newDevicePinConfirm) {
      setError("PINs do not match");
      return;
    }
    try {
      await unlockWithSeedphraseAndPin(seedphrase.trim().toLowerCase(), newDevicePin);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed — check your seedphrase");
      setNewDeviceStep("seedphrase");
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[400px]"
      >
        <AnimatePresence mode="wait">

          {/* ── PIN Unlock ──────────────────────────────── */}
          {mode === "pin" && (
            <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-display text-2xl mb-2">Vault locked</h2>
                <p className="font-accent text-[15px] text-muted-foreground">
                  Enter your PIN to unlock.
                </p>
              </div>

              <form onSubmit={handlePinUnlock} className="surface-card p-6 space-y-4">
                <div>
                  <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                    PIN
                  </label>
                  <div className="relative">
                    <Input
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => { setPin(e.target.value); setError(""); }}
                      placeholder="Enter PIN"
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

                {error && (
                  <p className="font-accent text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full btn-primary" disabled={isUnlocking || !pin.trim()}>
                  {isUnlocking ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Unlocking…</>
                  ) : (
                    <><Shield className="h-4 w-4 mr-2" /> Unlock vault</>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => { setMode("seedphrase"); setError(""); }}
                  className="font-accent text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Key className="h-3 w-3" />
                  Use seedphrase
                </button>
                <span className="text-muted-foreground/30">|</span>
                <button
                  type="button"
                  onClick={() => { setMode("forgot-pin"); setError(""); setNewDeviceStep("seedphrase"); setSeedphrase(""); setNewDevicePin(""); setNewDevicePinConfirm(""); }}
                  className="font-accent text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot PIN?
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Seedphrase Unlock (recovery) ────────────── */}
          {mode === "seedphrase" && (
            <motion.div key="seedphrase" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Key className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-display text-2xl mb-2">Recovery unlock</h2>
                <p className="font-accent text-[15px] text-muted-foreground">
                  Enter your full seedphrase to unlock and re-derive your keys.
                </p>
              </div>

              <form onSubmit={handleSeedphraseUnlock} className="surface-card p-6 space-y-4">
                <div>
                  <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                    Seedphrase
                  </label>
                  <div className="relative">
                    <textarea
                      rows={4}
                      value={seedphrase}
                      onChange={(e) => { setSeedphrase(e.target.value); setError(""); }}
                      placeholder="word1 word2 word3 …"
                      className={`w-full font-mono text-sm bg-muted/40 border border-border rounded-lg px-3 py-2.5 resize-none outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 transition-colors ${!showSeed ? "text-security-disc" : ""}`}
                      style={!showSeed ? { WebkitTextSecurity: "disc" } as React.CSSProperties : undefined}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowSeed((v) => !v)}
                    >
                      {showSeed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="font-accent text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full btn-primary" disabled={isUnlocking || !seedphrase.trim()}>
                  {isUnlocking ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Unlocking…</>
                  ) : (
                    <><Shield className="h-4 w-4 mr-2" /> Unlock vault</>
                  )}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => { setMode("pin"); setError(""); }}
                className="block mx-auto mt-4 font-accent text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to PIN unlock
              </button>
            </motion.div>
          )}

          {/* ── New Device Setup ────────────────────────── */}
          {mode === "new-device" && (
            <motion.div key="new-device" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <AnimatePresence mode="wait">

                {/* Step 1: Enter seedphrase */}
                {newDeviceStep === "seedphrase" && (
                  <motion.div key="nd-seed" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Smartphone className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="font-display text-2xl mb-2">New device</h2>
                      <p className="font-accent text-[15px] text-muted-foreground">
                        This device isn&apos;t set up yet. Enter your seedphrase to register it.
                      </p>
                    </div>

                    <form onSubmit={handleNewDeviceSeedphraseNext} className="surface-card p-6 space-y-4">
                      <div>
                        <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                          Seedphrase
                        </label>
                        <div className="relative">
                          <textarea
                            rows={4}
                            value={seedphrase}
                            onChange={(e) => { setSeedphrase(e.target.value); setError(""); }}
                            placeholder="word1 word2 word3 …"
                            className={`w-full font-mono text-sm bg-muted/40 border border-border rounded-lg px-3 py-2.5 resize-none outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 transition-colors ${!showSeed ? "text-security-disc" : ""}`}
                            style={!showSeed ? { WebkitTextSecurity: "disc" } as React.CSSProperties : undefined}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowSeed((v) => !v)}
                          >
                            {showSeed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <p className="font-accent text-sm text-destructive">{error}</p>
                      )}

                      <Button type="submit" className="w-full btn-primary" disabled={!seedphrase.trim()}>
                        Continue
                        <ChevronRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </form>
                  </motion.div>
                )}

                {/* Step 2: Register PIN for this device */}
                {newDeviceStep === "pin" && (
                  <motion.div key="nd-pin" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="font-display text-2xl mb-2">Register device PIN</h2>
                      <p className="font-accent text-[15px] text-muted-foreground">
                        Set a PIN to unlock your vault on this device.
                      </p>
                    </div>

                    <form onSubmit={handleNewDevicePinSubmit} className="surface-card p-6 space-y-4">
                      <div>
                        <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                          New PIN
                        </label>
                        <div className="relative">
                          <Input
                            type={showNewDevicePin ? "text" : "password"}
                            inputMode="numeric"
                            value={newDevicePin}
                            onChange={(e) => { setNewDevicePin(e.target.value); setError(""); }}
                            placeholder="Enter PIN"
                            className="input-refined pr-10 text-center text-lg tracking-[0.3em]"
                            autoComplete="off"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowNewDevicePin((v) => !v)}
                          >
                            {showNewDevicePin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                          Confirm PIN
                        </label>
                        <Input
                          type={showNewDevicePin ? "text" : "password"}
                          inputMode="numeric"
                          value={newDevicePinConfirm}
                          onChange={(e) => { setNewDevicePinConfirm(e.target.value); setError(""); }}
                          placeholder="Re-enter PIN"
                          className="input-refined text-center text-lg tracking-[0.3em]"
                          autoComplete="off"
                        />
                      </div>

                      {error && (
                        <p className="font-accent text-sm text-destructive">{error}</p>
                      )}

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => { setNewDeviceStep("seedphrase"); setError(""); }}
                          disabled={isUnlocking}
                        >
                          <ArrowLeft className="h-4 w-4 mr-1.5" />
                          Back
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 btn-primary"
                          disabled={isUnlocking || newDevicePin.length < 4 || newDevicePinConfirm.length < 4}
                        >
                          {isUnlocking ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting up…</>
                          ) : (
                            <><Shield className="h-4 w-4 mr-1.5" /> Set up device</>
                          )}
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          )}

          {/* ── Forgot PIN — reset via seedphrase ───────── */}
          {mode === "forgot-pin" && (
            <motion.div key="forgot-pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <AnimatePresence mode="wait">

                {/* Step 1: Verify seedphrase */}
                {newDeviceStep === "seedphrase" && (
                  <motion.div key="fp-seed" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Key className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="font-display text-2xl mb-2">Reset PIN</h2>
                      <p className="font-accent text-[15px] text-muted-foreground">
                        Enter your seedphrase to verify your identity and set a new PIN.
                      </p>
                    </div>

                    <form onSubmit={handleNewDeviceSeedphraseNext} className="surface-card p-6 space-y-4">
                      <div>
                        <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                          Seedphrase
                        </label>
                        <div className="relative">
                          <textarea
                            rows={4}
                            value={seedphrase}
                            onChange={(e) => { setSeedphrase(e.target.value); setError(""); }}
                            placeholder="word1 word2 word3 …"
                            className={`w-full font-mono text-sm bg-muted/40 border border-border rounded-lg px-3 py-2.5 resize-none outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 transition-colors ${!showSeed ? "text-security-disc" : ""}`}
                            style={!showSeed ? { WebkitTextSecurity: "disc" } as React.CSSProperties : undefined}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowSeed((v) => !v)}
                          >
                            {showSeed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <p className="font-accent text-sm text-destructive">{error}</p>
                      )}

                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => { setMode("pin"); setError(""); }}>
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button type="submit" className="flex-1 btn-primary" disabled={!seedphrase.trim()}>
                          Continue
                          <ChevronRight className="h-4 w-4 ml-1.5" />
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* Step 2: Set new PIN */}
                {newDeviceStep === "pin" && (
                  <motion.div key="fp-pin" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="font-display text-2xl mb-2">Set new PIN</h2>
                      <p className="font-accent text-[15px] text-muted-foreground">
                        Choose a new PIN for this device.
                      </p>
                    </div>

                    <form onSubmit={handleNewDevicePinSubmit} className="surface-card p-6 space-y-4">
                      <div>
                        <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                          New PIN
                        </label>
                        <div className="relative">
                          <Input
                            type={showNewDevicePin ? "text" : "password"}
                            inputMode="numeric"
                            value={newDevicePin}
                            onChange={(e) => { setNewDevicePin(e.target.value); setError(""); }}
                            placeholder="Enter PIN"
                            className="input-refined pr-10 text-center text-lg tracking-[0.3em]"
                            autoComplete="off"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowNewDevicePin((v) => !v)}
                          >
                            {showNewDevicePin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                          Confirm PIN
                        </label>
                        <Input
                          type={showNewDevicePin ? "text" : "password"}
                          inputMode="numeric"
                          value={newDevicePinConfirm}
                          onChange={(e) => { setNewDevicePinConfirm(e.target.value); setError(""); }}
                          placeholder="Re-enter PIN"
                          className="input-refined text-center text-lg tracking-[0.3em]"
                          autoComplete="off"
                        />
                      </div>

                      {error && (
                        <p className="font-accent text-sm text-destructive">{error}</p>
                      )}

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setNewDeviceStep("seedphrase"); setError(""); }}
                          disabled={isUnlocking}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 btn-primary"
                          disabled={isUnlocking || newDevicePin.length < 4 || newDevicePinConfirm.length < 4}
                        >
                          {isUnlocking ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                          ) : (
                            <><Shield className="h-4 w-4 mr-1.5" /> Save new PIN</>
                          )}
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>

        <p className="text-center font-accent text-xs text-muted-foreground mt-4">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono">Ctrl+Shift+L</kbd> to lock from anywhere.
        </p>
      </motion.div>
    </div>
  );
}

// ── Vault content wrapper ────────────────────────────────────

function VaultContent({ children }: { children: ReactNode }) {
  const { isLocked } = useVault();

  return (
    <AnimatePresence mode="wait">
      {isLocked ? (
        <motion.div
          key="lock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <LockScreen />
        </motion.div>
      ) : (
        <motion.div
          key="vault"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Layout export ────────────────────────────────────────────

export default function VaultLayout({ children }: { children: ReactNode }) {
  return (
    <VaultProvider>
      <VaultContent>{children}</VaultContent>
    </VaultProvider>
  );
}

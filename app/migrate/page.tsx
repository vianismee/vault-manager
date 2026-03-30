"use client";

/**
 * Migration Wizard — TASK-023G
 *
 * Steps:
 *  1. Detect legacy credentials + show count
 *  2. User enters seedphrase to derive migration keys
 *  3. Migration progress (animated list)
 *  4. Confirm vault looks correct → Archive old data
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ArrowRight,
  Check,
  Loader2,
  AlertTriangle,
  Archive,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { validateMnemonic, mnemonicToMasterSeed } from "@/lib/crypto/seedphrase";
import { deriveVaultKey, deriveIdentityKey } from "@/lib/crypto/hd-keys";
import { deriveEd25519Keypair } from "@/lib/crypto/keypair";
import { importAesKey } from "@/lib/crypto/block-cipher";
import {
  countLegacyCredentials,
  migrateVault,
  archiveLegacyCredentials,
} from "@/lib/migration/migrate-vault";

type Step = "detect" | "seedphrase" | "migrating" | "review" | "done";

const SLIDE = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

interface ProgressEntry {
  title: string;
  status: "pending" | "done" | "error";
}

export default function MigratePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("detect");
  const [legacyCount, setLegacyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seedphrase, setSeedphrase] = useState("");
  const [seedphraseError, setSeedphraseError] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [migratedCount, setMigratedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const progressListRef = useRef<HTMLDivElement>(null);

  // ── Detect legacy credentials ───────────────────────────
  useEffect(() => {
    async function detect() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/auth/login"); return; }

        // If vault chain is already migrated, go straight to vault
        const { data: chain } = await supabase
          .from("vault_chains")
          .select("migration_status")
          .eq("user_id", user.id)
          .single();

        if (chain?.migration_status === "completed") {
          router.replace("/vault");
          return;
        }

        const count = await countLegacyCredentials(supabase, user.id);
        setLegacyCount(count);
        if (count === 0) {
          router.replace("/vault");
          return;
        }
      } catch {
        router.replace("/vault");
      } finally {
        setLoading(false);
      }
    }
    detect();
  }, [router]);

  // Auto-scroll progress list
  useEffect(() => {
    progressListRef.current?.scrollTo({ top: 9999, behavior: "smooth" });
  }, [progress]);

  // ── Seedphrase validation ───────────────────────────────
  function handleSeedphraseChange(v: string) {
    setSeedphrase(v);
    setSeedphraseError("");
  }

  async function handleStartMigration() {
    const trimmed = seedphrase.trim().toLowerCase();
    if (!validateMnemonic(trimmed)) {
      setSeedphraseError("Invalid seedphrase — check for typos or missing words.");
      return;
    }

    setStep("migrating");
    setMigrating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get vault chain
      const { data: chain } = await supabase
        .from("vault_chains")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!chain) throw new Error("Vault chain not found");

      // Derive keys
      const masterSeed = await mnemonicToMasterSeed(trimmed);
      const vaultKeyRaw = deriveVaultKey(masterSeed);
      const identitySeed = deriveIdentityKey(masterSeed);
      masterSeed.fill(0);

      const { privateKey } = deriveEd25519Keypair(identitySeed);
      identitySeed.fill(0);

      const vaultKey = await importAesKey(vaultKeyRaw); // zeros vaultKeyRaw

      const legacyKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY ?? "";

      // Run migration
      const result = await migrateVault({
        userId: user.id,
        chainId: chain.id,
        legacyKey,
        vaultKey,
        privateKey,
        supabase,
        onProgress: (current, total, title) => {
          setProgress((prev) => {
            // Mark previous as done
            const next = prev.map((e, i) =>
              i === prev.length - 1 ? { ...e, status: "done" as const } : e
            );
            next.push({ title, status: "pending" });
            return next;
          });
        },
      });

      // Mark last entry as done
      setProgress((prev) =>
        prev.map((e, i) =>
          i === prev.length - 1 ? { ...e, status: result.status === "completed" ? "done" : "error" } : e
        )
      );

      privateKey.fill(0);

      setMigratedCount(result.migratedCount);
      setFailedCount(result.failedCredentials.length);

      if (result.status === "rolled_back") {
        toast.error("Migration failed — rolled back. Try again.");
        setStep("seedphrase");
      } else {
        setTimeout(() => setStep("review"), 800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Migration failed";
      toast.error(msg);
      setStep("seedphrase");
    } finally {
      setMigrating(false);
    }
  }

  // ── Archive step ────────────────────────────────────────
  async function handleConfirmArchive() {
    setArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: chain } = await supabase
        .from("vault_chains")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (chain) {
        await archiveLegacyCredentials(supabase, user.id, chain.id);
      }

      setStep("done");
      setTimeout(() => router.replace("/vault"), 1500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setArchiving(false);
    }
  }

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

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

          {/* ── Step 1: Detect ─────────────────────────── */}
          {step === "detect" && (
            <motion.div key="detect" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5">
                  <Archive className="h-8 w-8 text-amber-500" />
                </div>
                <h1 className="font-display text-2xl mb-2">Migration required</h1>
                <p className="font-accent text-[15px] text-muted-foreground">
                  We found <strong className="text-foreground">{legacyCount} credential{legacyCount !== 1 ? "s" : ""}</strong> from your previous vault. These need to be migrated to the new secure chain format before you can continue.
                </p>
              </div>

              <div className="surface-card p-5 mb-6 space-y-3">
                {[
                  "Your passwords will be re-encrypted with your personal seedphrase key",
                  "Original data is archived (not deleted) until you confirm",
                  "Migration runs entirely on your device — nothing sent unencrypted",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <p className="font-accent text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>

              <Button className="w-full btn-primary" onClick={() => setStep("seedphrase")}>
                Start migration
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
              <p className="text-center font-accent text-xs text-muted-foreground mt-4">
                You can skip this and migrate later from Settings.{" "}
                <button onClick={() => router.replace("/vault")} className="text-primary hover:underline">
                  Skip for now
                </button>
              </p>
            </motion.div>
          )}

          {/* ── Step 2: Seedphrase ─────────────────────── */}
          {step === "seedphrase" && (
            <motion.div key="seedphrase" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}>
              <div className="text-center mb-6">
                <h1 className="font-display text-2xl mb-2">Enter your seedphrase</h1>
                <p className="font-accent text-[15px] text-muted-foreground">
                  Your seedphrase is used to derive the encryption key for migrating your credentials.
                </p>
              </div>

              <div className="surface-card p-5 mb-4">
                <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                  Seedphrase
                </label>
                <textarea
                  rows={4}
                  value={seedphrase}
                  onChange={(e) => handleSeedphraseChange(e.target.value)}
                  placeholder="word1 word2 word3 … word24"
                  className="w-full font-mono text-sm bg-transparent resize-none outline-none placeholder:text-muted-foreground/50"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onPaste={(e) => e.preventDefault()} // SEC-003
                />
              </div>

              {seedphraseError && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="font-accent text-sm text-destructive">{seedphraseError}</p>
                </div>
              )}

              <p className="font-accent text-xs text-muted-foreground mb-4 text-center">
                Paste is disabled for security. Type your seedphrase manually.
              </p>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep("detect")}>
                  Back
                </Button>
                <Button
                  className="flex-1 btn-primary"
                  onClick={handleStartMigration}
                  disabled={!seedphrase.trim()}
                >
                  Migrate {legacyCount} credentials
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Migrating ──────────────────────── */}
          {step === "migrating" && (
            <motion.div key="migrating" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}>
              <div className="text-center mb-6">
                <h1 className="font-display text-2xl mb-2">Migrating your vault</h1>
                <p className="font-accent text-[15px] text-muted-foreground">
                  Re-encrypting credentials into the secure chain…
                </p>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full mb-5 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{
                    width: progress.length === 0 ? "5%" : `${Math.min(95, (progress.filter((p) => p.status === "done").length / legacyCount) * 100)}%`,
                  }}
                  transition={{ ease: "easeOut", duration: 0.4 }}
                />
              </div>

              {/* Scrollable progress list */}
              <div
                ref={progressListRef}
                className="surface-card p-4 h-52 overflow-y-auto space-y-1.5 scrollbar-thin"
              >
                {progress.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="font-accent text-sm">Starting migration…</span>
                  </div>
                ) : (
                  progress.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {entry.status === "pending" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
                      {entry.status === "done" && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                      {entry.status === "error" && <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      <span className={`font-accent text-sm truncate ${entry.status === "pending" ? "text-foreground" : "text-muted-foreground"}`}>
                        {entry.title}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <p className="text-center font-accent text-xs text-muted-foreground mt-4">
                {progress.filter((p) => p.status === "done").length} / {legacyCount} credentials migrated
              </p>
            </motion.div>
          )}

          {/* ── Step 4: Review ─────────────────────────── */}
          {step === "review" && (
            <motion.div key="review" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center mb-5">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <h1 className="font-display text-2xl mb-2">Migration complete</h1>
                <p className="font-accent text-[15px] text-muted-foreground">
                  <strong className="text-foreground">{migratedCount} credential{migratedCount !== 1 ? "s" : ""}</strong> moved to the secure chain.
                  {failedCount > 0 && (
                    <span className="text-amber-500"> {failedCount} could not be decrypted and were skipped.</span>
                  )}
                </p>
              </div>

              <div className="surface-card p-5 mb-6">
                <p className="font-accent text-sm text-muted-foreground mb-4">
                  Please verify your vault looks correct before we archive the old data. Your original records will be kept as read-only backup.
                </p>
                <Button
                  variant="outline"
                  className="w-full mb-3"
                  onClick={() => router.push("/vault")}
                >
                  Review vault first
                </Button>
                <Button
                  className="w-full btn-primary"
                  onClick={handleConfirmArchive}
                  disabled={archiving}
                >
                  {archiving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Archiving…</>
                  ) : (
                    <><Archive className="h-4 w-4 mr-1.5" /> Confirm &amp; Archive old data</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 5: Done ───────────────────────────── */}
          {step === "done" && (
            <motion.div key="done" variants={SLIDE} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.25,0.1,0.25,1] }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-xl mb-2">Your vault is ready</h2>
              <p className="font-accent text-[15px] text-muted-foreground">
                Redirecting to your vault…
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Step dots */}
      {step !== "migrating" && step !== "done" && (
        <div className="flex gap-1.5 mt-8">
          {(["detect", "seedphrase", "review"] as const).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                step === s ? "w-6 bg-primary" : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

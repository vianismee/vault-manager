"use client";

/**
 * Shamir's Secret Sharing UI — TASK-028
 * Split a BIP-39 seedphrase into n shares (threshold k-of-n).
 * Combine k or more shares to recover the original seedphrase.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  GitBranch,
  Shield,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft as Prev,
  AlertTriangle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { split, combine } from "@/lib/crypto/sss";
import { validateMnemonic } from "@/lib/crypto/seedphrase";

type Tab = "split" | "combine";
type SplitStep = "input" | "shares";

export default function SSSPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("split");

  // ── Split state ──────────────────────────────────────────
  const [splitStep, setSplitStep] = useState<SplitStep>("input");
  const [seedphrase, setSeedphrase] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [k, setK] = useState(3);
  const [n, setN] = useState(5);
  const [shares, setShares] = useState<string[]>([]);
  const [currentShareIdx, setCurrentShareIdx] = useState(0);
  const [copiedShare, setCopiedShare] = useState(false);
  const [splitError, setSplitError] = useState("");

  // ── Combine state ────────────────────────────────────────
  const [combineShares, setCombineShares] = useState<string[]>(["", ""]);
  const [recovered, setRecovered] = useState("");
  const [showRecovered, setShowRecovered] = useState(false);
  const [combineError, setCombineError] = useState("");
  const [copiedRecovered, setCopiedRecovered] = useState(false);

  // ── Split handlers ───────────────────────────────────────
  function handleSplit() {
    setSplitError("");
    const trimmed = seedphrase.trim().toLowerCase();
    if (!validateMnemonic(trimmed)) {
      setSplitError("Invalid seedphrase — check spelling and word count (12 or 24 words).");
      return;
    }
    if (k > n) {
      setSplitError("Threshold k cannot exceed total shares n.");
      return;
    }
    try {
      const generated = split(trimmed, k, n);
      setShares(generated);
      setCurrentShareIdx(0);
      setSplitStep("shares");
    } catch (err: unknown) {
      setSplitError(err instanceof Error ? err.message : "Split failed");
    }
  }

  async function handleCopyShare() {
    await navigator.clipboard.writeText(shares[currentShareIdx]);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  }

  function handleReset() {
    setSeedphrase("");
    setShares([]);
    setCurrentShareIdx(0);
    setSplitStep("input");
    setSplitError("");
    setShowSeed(false);
  }

  // ── Combine handlers ─────────────────────────────────────
  function handleAddShareField() {
    setCombineShares((prev) => [...prev, ""]);
  }

  function handleRemoveShareField(i: number) {
    setCombineShares((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleCombine() {
    setCombineError("");
    setRecovered("");
    const filled = combineShares.filter((s) => s.trim());
    if (filled.length < 2) {
      setCombineError("Enter at least 2 shares.");
      return;
    }
    try {
      const result = combine(filled.map((s) => s.trim()));
      setRecovered(result);
    } catch (err: unknown) {
      setCombineError(err instanceof Error ? err.message : "Combine failed — check shares for typos");
    }
  }

  async function handleCopyRecovered() {
    await navigator.clipboard.writeText(recovered);
    setCopiedRecovered(true);
    toast.success("Seedphrase copied");
    setTimeout(() => setCopiedRecovered(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex h-14 items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="font-display text-lg">Seedphrase Backup</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/60 rounded-xl mb-6">
          {(["split", "combine"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); handleReset(); setCombineError(""); setRecovered(""); }}
              className={`flex-1 py-2 px-4 rounded-lg font-accent text-sm font-medium transition-all ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "split" ? "Split into Shares" : "Recover from Shares"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Split Tab ─────────────────────────────────── */}
          {tab === "split" && (
            <motion.div
              key="split"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AnimatePresence mode="wait">

                {/* Step 1: Input */}
                {splitStep === "input" && (
                  <motion.div key="input" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
                    <div className="surface-card p-5 space-y-4">
                      {/* Seedphrase */}
                      <div>
                        <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                          Your Seedphrase
                        </label>
                        <div className="relative">
                          <textarea
                            rows={3}
                            value={seedphrase}
                            onChange={(e) => { setSeedphrase(e.target.value); setSplitError(""); }}
                            placeholder="word1 word2 word3 …"
                            className={`w-full font-mono text-sm bg-muted/40 border border-border rounded-lg px-3 py-2.5 resize-none outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 transition-colors ${!showSeed ? "text-security-disc" : ""}`}
                            style={!showSeed ? { WebkitTextSecurity: "disc" } as React.CSSProperties : undefined}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            onPaste={(e) => e.preventDefault()}
                          />
                          <button
                            type="button"
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowSeed((v) => !v)}
                          >
                            {showSeed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="font-accent text-[11px] text-muted-foreground mt-1">Paste disabled for security — type manually.</p>
                      </div>

                      {/* k / n sliders */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                            Threshold (k) — {k} shares needed
                          </label>
                          <input
                            type="range"
                            min={2}
                            max={n}
                            value={k}
                            onChange={(e) => setK(Number(e.target.value))}
                            className="w-full accent-primary"
                          />
                          <div className="flex justify-between font-accent text-[11px] text-muted-foreground mt-0.5">
                            <span>2</span><span>{n}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block font-accent text-xs font-semibold tracking-wide text-muted-foreground mb-1.5">
                            Total shares (n) — {n} generated
                          </label>
                          <input
                            type="range"
                            min={k}
                            max={10}
                            value={n}
                            onChange={(e) => { const val = Number(e.target.value); setN(val); if (k > val) setK(val); }}
                            className="w-full accent-primary"
                          />
                          <div className="flex justify-between font-accent text-[11px] text-muted-foreground mt-0.5">
                            <span>{k}</span><span>10</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15">
                        <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p className="font-accent text-xs text-muted-foreground">
                          Any <strong className="text-foreground">{k} of {n}</strong> shares can reconstruct your seedphrase. Store each share in a separate secure location.
                        </p>
                      </div>
                    </div>

                    {splitError && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        <p className="font-accent text-sm text-destructive">{splitError}</p>
                      </div>
                    )}

                    <Button
                      className="w-full btn-primary"
                      onClick={handleSplit}
                      disabled={!seedphrase.trim()}
                    >
                      <GitBranch className="h-4 w-4 mr-2" />
                      Generate {n} shares
                    </Button>
                  </motion.div>
                )}

                {/* Step 2: Show shares one by one */}
                {splitStep === "shares" && (
                  <motion.div key="shares" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }} className="space-y-5">
                    {/* Progress */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-accent text-sm font-semibold">
                        Share {currentShareIdx + 1} of {shares.length}
                      </span>
                      <span className="font-accent text-xs text-muted-foreground">
                        {k}-of-{n} threshold
                      </span>
                    </div>

                    {/* Step dots */}
                    <div className="flex gap-1.5">
                      {shares.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            i < currentShareIdx ? "bg-primary/40" : i === currentShareIdx ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Share display */}
                    <div className="surface-card p-5 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="font-display text-xs text-primary font-bold">{currentShareIdx + 1}</span>
                        </div>
                        <p className="font-accent text-sm font-semibold">Share #{currentShareIdx + 1}</p>
                      </div>

                      <div className="bg-muted/60 rounded-lg p-3 break-all">
                        <p className="font-mono text-xs leading-relaxed select-all">{shares[currentShareIdx]}</p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleCopyShare}
                      >
                        {copiedShare ? (
                          <><Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> Copied</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy share</>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="font-accent text-xs text-amber-700 dark:text-amber-400">
                        Write this share down on paper or store it offline. Never store all shares in the same place.
                      </p>
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={currentShareIdx === 0}
                        onClick={() => setCurrentShareIdx((i) => i - 1)}
                      >
                        <Prev className="h-4 w-4 mr-1.5" />
                        Previous
                      </Button>

                      {currentShareIdx < shares.length - 1 ? (
                        <Button
                          className="flex-1 btn-primary"
                          onClick={() => setCurrentShareIdx((i) => i + 1)}
                        >
                          Next share
                          <ChevronRight className="h-4 w-4 ml-1.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={handleReset}
                        >
                          <RefreshCw className="h-4 w-4 mr-1.5" />
                          Start over
                        </Button>
                      )}
                    </div>

                    {currentShareIdx === shares.length - 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2.5 p-4 rounded-xl bg-green-500/10 border border-green-500/20"
                      >
                        <Check className="h-5 w-5 text-green-600 shrink-0" />
                        <p className="font-accent text-sm text-green-700 dark:text-green-400 font-medium">
                          All {shares.length} shares generated. Store each one separately in a secure offline location.
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          )}

          {/* ── Combine Tab ─────────────────────────────────── */}
          {tab === "combine" && (
            <motion.div
              key="combine"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="surface-card p-5 space-y-3">
                <p className="font-accent text-xs font-semibold tracking-wide text-muted-foreground">
                  Enter shares (minimum threshold required)
                </p>

                {combineShares.map((share, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <span className="font-accent text-[11px] text-muted-foreground font-bold">{i + 1}</span>
                    </div>
                    <Input
                      value={share}
                      onChange={(e) => {
                        const next = [...combineShares];
                        next[i] = e.target.value;
                        setCombineShares(next);
                        setCombineError("");
                        setRecovered("");
                      }}
                      placeholder={`Share #${i + 1} — e.g. 1:4a7f…`}
                      className="input-refined font-mono text-xs flex-1"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                    {combineShares.length > 2 && (
                      <button
                        onClick={() => handleRemoveShareField(i)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={handleAddShareField}
                  className="flex items-center gap-1.5 font-accent text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another share
                </button>
              </div>

              {combineError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="font-accent text-sm text-destructive">{combineError}</p>
                </div>
              )}

              <Button
                className="w-full btn-primary"
                onClick={handleCombine}
                disabled={combineShares.filter((s) => s.trim()).length < 2}
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Recover seedphrase
              </Button>

              {/* Result */}
              <AnimatePresence>
                {recovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="surface-card p-5 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      <p className="font-accent text-sm font-semibold text-green-600 dark:text-green-400">Seedphrase recovered</p>
                    </div>

                    <div className="relative">
                      <div className={`bg-muted/60 rounded-lg p-3 font-mono text-sm leading-relaxed break-words ${!showRecovered ? "blur-sm select-none" : ""}`}>
                        {recovered}
                      </div>
                      {!showRecovered && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            onClick={() => setShowRecovered(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-background/90 border border-border rounded-lg font-accent text-xs font-medium"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Reveal
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setShowRecovered((v) => !v)}
                      >
                        {showRecovered ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                        {showRecovered ? "Hide" : "Show"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleCopyRecovered}
                        disabled={!showRecovered}
                      >
                        {copiedRecovered ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                        {copiedRecovered ? "Copied" : "Copy"}
                      </Button>
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="font-accent text-xs text-amber-700 dark:text-amber-400">
                        Clear this page after copying. Never store your seedphrase digitally.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

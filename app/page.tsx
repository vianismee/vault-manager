"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Shield,
  Key,
  Lock,
  ArrowRight,
  Check,
  Clock,
  Sparkles,
  Loader2,
  Link2,
  Fingerprint,
  Share2,
  History,
  FileDown,
  QrCode,
  Atom,
  ScanLine,
} from "lucide-react";
import { isMobile, isStandalone } from "@/lib/mobile";

// Fade-in animation component
function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Scroll reveal component
function ScrollReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "start 0.5"],
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [30, 0]);

  return (
    <motion.div ref={ref} style={{ opacity, y }} className={className}>
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      // If running in PWA standalone mode and not authenticated, redirect to login
      if (isStandalone() && !session) {
        router.push("/auth/login");
        return;
      }

      if (session) {
        // Redirect to mobile vault if on mobile device
        if (isMobile()) {
          router.push("/vault/mobile");
        } else {
          router.push("/vault");
        }
      }
    };
    checkAuth();
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Link2,
      title: "Blockchain Credential Chain",
      description: "Every credential change creates a cryptographically linked block. Tamper with one, and the entire chain breaks — making unauthorized modifications impossible to hide.",
    },
    {
      icon: Key,
      title: "Seedphrase Recovery",
      description: "A 12 or 24-word BIP-39 seedphrase is your master key. Recover your entire vault from any device, anytime. No email dependency.",
    },
    {
      icon: Shield,
      title: "Zero-Knowledge Encryption",
      description: "AES-256-GCM encryption on your device before data reaches our servers. We literally cannot see your passwords — ever.",
    },
    {
      icon: Clock,
      title: "Built-in Authenticator",
      description: "Store TOTP secrets and generate 2FA codes instantly. One-click copy means your codes are always ready when you need them.",
    },
    {
      icon: Share2,
      title: "Vault Sharing via Public Key",
      description: "Share credentials securely using Ed25519 public key encryption. Recipients decrypt with their private key — the server never sees plaintext.",
    },
    {
      icon: Fingerprint,
      title: "Multi-Device Authorization",
      description: "Add new devices via keypair authentication. Your seedphrase never leaves the original device. Revoke access instantly if a device is lost.",
    },
    {
      icon: History,
      title: "Credential Version History",
      description: "Every edit creates a new block — old versions are never overwritten. View full password history and restore any previous version instantly.",
    },
    {
      icon: Atom,
      title: "Post-Quantum Ready",
      description: "Hybrid signatures with SPHINCS+ protect against future quantum attacks. Your vault is ready for the next era of cryptography.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Create your account",
      description: "Sign up with your email. We'll generate a unique seedphrase — your master key to everything.",
    },
    {
      number: "02",
      title: "Backup your seedphrase",
      description: "Write down your 12-word seedphrase. Use Shamir's Secret Sharing to split it across trusted locations for extra safety.",
    },
    {
      number: "03",
      title: "Add your credentials",
      description: "Import from browsers or other managers. Every entry becomes a block in your tamper-proof credential chain.",
    },
    {
      number: "04",
      title: "Access from anywhere",
      description: "Your seedphrase + any device = full vault access. Or authorize devices with biometrics for daily use.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Lock className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display text-base">Vault</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="font-accent text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/auth/login"
              className="btn-primary inline-flex items-center justify-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-20 sm:pt-36 sm:pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Hero Content */}
            <div className="text-center lg:text-left">
              <FadeIn delay={0}>
                <span className="tag bg-primary/10 text-primary mb-6">
                  <Sparkles className="h-3 w-3" />
                  Blockchain-secured credentials
                </span>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1 className="mb-6">
                  Your passwords,
                  <br />
                  <span className="text-primary">unchangeable.</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-[17px] text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                  A password manager built on a credential chain — every change is a
                  cryptographically linked block. Tamper-proof, zero-knowledge, and
                  post-quantum ready.
                </p>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Link
                    href="/auth/login"
                    className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 text-base h-auto"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#features"
                    className="btn-secondary inline-flex items-center justify-center px-6 py-3 text-base h-auto"
                  >
                    Learn More
                  </a>
                </div>
              </FadeIn>

              {/* Trust indicators */}
              <FadeIn delay={0.4}>
                <div className="flex items-center justify-center lg:justify-start gap-5 mt-10 pt-10 border-t border-border/60">
                  <div className="flex items-center gap-1.5 font-accent text-sm text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    <span>Credential Chain</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-accent text-sm text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    <span>AES-256-GCM</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-accent text-sm text-muted-foreground">
                    <Atom className="h-3.5 w-3.5" />
                    <span>Post-Quantum</span>
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Hero Visual */}
            <FadeIn delay={0.2}>
              <div className="relative">
                {/* Main card — Credential Chain visualization */}
                <div className="surface-card p-7">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Link2 className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <div className="font-accent font-semibold text-sm">Credential Chain</div>
                      <div className="font-accent text-xs text-muted-foreground">6 blocks · Chain verified</div>
                    </div>
                    <div className="ml-auto">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success font-accent text-[11px]">
                        <Check className="h-3 w-3" />
                        Intact
                      </span>
                    </div>
                  </div>

                  {/* Chain blocks */}
                  <div className="space-y-1.5">
                    {[
                      { index: 0, op: "GENESIS", name: "Vault created", time: "Mar 28", hash: "a3f2...c91b" },
                      { index: 1, op: "CREATE", name: "GitHub", time: "Mar 29", hash: "7d4e...f208" },
                      { index: 2, op: "CREATE", name: "Google", time: "Mar 29", hash: "b1c9...4a37" },
                      { index: 3, op: "UPDATE", name: "GitHub", time: "Mar 30", hash: "e5f1...9d6c" },
                      { index: 4, op: "CREATE", name: "AWS Console", time: "Mar 30", hash: "2a8b...71f3" },
                    ].map((block, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.08 }}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-surface"
                      >
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                          block.op === "GENESIS" ? "bg-primary/10 text-primary" :
                          block.op === "CREATE" ? "bg-success/10 text-success" :
                          block.op === "UPDATE" ? "bg-warning/10 text-warning" :
                          "bg-destructive/10 text-destructive"
                        }`}>
                          #{block.index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-accent font-semibold text-xs text-foreground">{block.name}</span>
                            <span className={`font-accent text-[10px] px-1.5 py-0.5 rounded ${
                              block.op === "GENESIS" ? "bg-primary/10 text-primary" :
                              block.op === "CREATE" ? "bg-success/10 text-success" :
                              block.op === "UPDATE" ? "bg-warning/10 text-warning" :
                              "bg-destructive/10 text-destructive"
                            }`}>
                              {block.op}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">sha256:{block.hash}</div>
                        </div>
                        <span className="font-accent text-[10px] text-muted-foreground">{block.time}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Chain integrity indicator */}
                  <div className="mt-3 p-3 bg-muted/60 border border-border/40 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ScanLine className="h-3.5 w-3.5 text-success" />
                        <span className="font-accent text-xs text-muted-foreground">Chain integrity verified</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        <span className="font-accent text-[11px] text-success">Ed25519 + SPHINCS+</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating notification — Tamper proof */}
                <motion.div
                  initial={{ opacity: 0, x: 20, y: -20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="absolute -right-3 -top-3 surface-card p-3 flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-3.5 w-3.5 text-success" />
                  </div>
                  <div>
                    <div className="font-accent font-semibold text-xs">Tamper-proof</div>
                    <div className="font-accent text-[11px] text-muted-foreground">5 blocks verified</div>
                  </div>
                </motion.div>

                {/* Floating seedphrase indicator */}
                <motion.div
                  initial={{ opacity: 0, x: -20, y: 20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.5 }}
                  className="absolute -left-3 -bottom-3 surface-card p-3 flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Key className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <div className="font-accent font-semibold text-xs">12-word seedphrase</div>
                    <div className="font-accent text-[11px] text-muted-foreground">BIP-39 · Your master key</div>
                  </div>
                </motion.div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32 px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="section-label mb-3">Features</p>
              <h2 className="mb-4">
                Blockchain-grade security for your credentials
              </h2>
              <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto">
                Every credential is a block in a tamper-proof chain. Zero-knowledge by design, post-quantum by default.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature, i) => (
              <ScrollReveal key={i}>
                <div className="group card-interactive p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2">{feature.title}</h3>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <p className="section-label mb-3">How it works</p>
              <h2 className="mb-4">
                Get started in seconds
              </h2>
              <p className="text-[17px] text-muted-foreground">
                No credit card required. No complicated setup.
              </p>
            </div>
          </ScrollReveal>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <ScrollReveal key={i}>
                <div className="flex gap-5 p-5 surface-card">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="font-accent text-sm font-bold text-primary">{step.number}</span>
                    </div>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h3 className="mb-1">{step.title}</h3>
                    <p className="text-[15px] text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 sm:py-32 px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <ScrollReveal>
              <div>
                <span className="tag bg-primary/10 text-primary mb-6">
                  <Shield className="h-3 w-3" />
                  Security Architecture
                </span>
                <h2 className="mb-5">
                  Tamper-proof by design
                </h2>
                <p className="text-[17px] text-muted-foreground mb-8 leading-relaxed">
                  Your credentials form a blockchain-style chain. Every block is linked to the previous
                  one via SHA-256 hashes and signed with Ed25519. Modify one byte, and the entire chain
                  breaks — tampering is mathematically detectable.
                </p>

                <div className="space-y-3">
                  {[
                    "AES-256-GCM encryption with non-extractable keys",
                    "Ed25519 signatures on every credential block",
                    "SPHINCS+ post-quantum hybrid signatures",
                    "Chain integrity verification on every vault open",
                    "Shamir's Secret Sharing for seedphrase backup",
                    "WebAuthn Secure Enclave key binding",
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-success" />
                      </div>
                      <span className="font-accent text-[15px] text-muted-foreground">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="space-y-4">
                {/* Crypto stack cards */}
                <div className="surface-card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Lock className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <div className="font-accent font-semibold text-sm">Symmetric Encryption</div>
                      <div className="font-accent text-xs text-muted-foreground">Block payload encryption</div>
                    </div>
                  </div>
                  <div className="font-mono text-3xl font-semibold text-primary">AES-256-GCM</div>
                  <p className="text-xs text-muted-foreground mt-1">Non-extractable CryptoKey · HD-derived per vault</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="surface-card p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <ScanLine className="h-4 w-4 text-success" />
                      <span className="font-accent font-semibold text-xs">Signing</span>
                    </div>
                    <div className="font-mono text-lg font-semibold text-foreground">Ed25519</div>
                    <p className="text-[11px] text-muted-foreground mt-1">64-byte signatures · Deterministic</p>
                  </div>

                  <div className="surface-card p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Atom className="h-4 w-4 text-warning" />
                      <span className="font-accent font-semibold text-xs">Post-Quantum</span>
                    </div>
                    <div className="font-mono text-lg font-semibold text-foreground">SPHINCS+</div>
                    <p className="text-[11px] text-muted-foreground mt-1">FIPS 205 · Hybrid mode</p>
                  </div>
                </div>

                <div className="surface-card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Key className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <div className="font-accent font-semibold text-sm">Key Derivation</div>
                    </div>
                  </div>
                  <div className="font-mono text-sm text-muted-foreground leading-relaxed">
                    <span className="text-primary">m/vault/0</span> → AES key · <span className="text-primary">m/identity/0</span> → Ed25519 · <span className="text-primary">m/cat/N</span> → Per-category
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section className="py-20 sm:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="section-label mb-3">Advanced</p>
              <h2 className="mb-4">
                Built for the paranoid, designed for everyone
              </h2>
              <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto">
                From Shamir's Secret Sharing to emergency kill switches — enterprise-grade security in a consumer app.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <ScrollReveal>
              <div className="group card-interactive p-6 h-full">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                  <Shield className="h-5 w-5 text-warning" />
                </div>
                <h3 className="mb-2">Shamir's Secret Sharing</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Split your seedphrase into 5 shares. Any 3 reconstructs it. Distribute to trusted locations for bulletproof backup.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="group card-interactive p-6 h-full">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                  <Lock className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="mb-2">Emergency Kill Switch</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  One signed command freezes your vault, revokes all devices, and invalidates every session. Recover anytime with your seedphrase.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="group card-interactive p-6 h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                  <FileDown className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2">Vault Snapshots</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Export your entire chain as an encrypted file. Import on any device with your seedphrase. Full portability, zero trust required.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="group card-interactive p-6 h-full">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                  <QrCode className="h-5 w-5 text-success" />
                </div>
                <h3 className="mb-2">QR Device Pairing</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Add a new device by scanning a QR code. Your seedphrase never crosses devices — only an encrypted vault key does.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="group card-interactive p-6 h-full">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                  <History className="h-5 w-5 text-warning" />
                </div>
                <h3 className="mb-2">Tamper-Evident Audit Log</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Every CREATE, UPDATE, and DELETE operation is a permanent, signed block. Full history with cryptographic proof — nothing is hidden.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="group card-interactive p-6 h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                  <Fingerprint className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2">Secure Enclave Binding</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  Vault keys are wrapped with WebAuthn hardware keys. Biometric or PIN required to unlock — stealing IndexedDB files isn't enough.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="mb-5">
              Ready to make your credentials unchangeable?
            </h2>
            <p className="text-[17px] text-muted-foreground mb-10 max-w-xl mx-auto">
              Blockchain-grade security meets zero-knowledge privacy.
              Your seedphrase, your vault, your rules.
            </p>
            <Link
              href="/auth/login"
              className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 text-base h-auto"
            >
              Create Your Vault
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="flex items-center justify-center gap-6 mt-8 font-accent text-sm text-muted-foreground">
              <span>Free forever plan</span>
              <span>·</span>
              <span>Post-quantum ready</span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Lock className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-display text-base">Vault</span>
            </div>

            <p className="font-accent text-sm text-muted-foreground">
              © {new Date().getFullYear()} Vault. Your credentials, unchangeable.
            </p>

            <div className="flex items-center gap-5 font-accent text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Security</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

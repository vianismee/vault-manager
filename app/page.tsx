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
  Mail,
  ArrowRight,
  Check,
  Clock,
  Smartphone,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
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
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});

  const togglePassword = (index: number) => {
    setVisiblePasswords(prev => ({ ...prev, [index]: !prev[index] }));
  };

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
      icon: Shield,
      title: "Zero-Knowledge Encryption",
      description: "Your passwords are encrypted with AES-256 on your device before they ever reach our servers. We literally cannot see your passwords.",
    },
    {
      icon: Key,
      title: "Built-in Authenticator",
      description: "Store TOTP secrets and generate 2FA codes instantly. One-click copy means your codes are always ready when you need them.",
    },
    {
      icon: Mail,
      title: "Magic Link Sign-In",
      description: "No master passwords to remember. Just click the link in your email and you're in. Simple, secure, and surprisingly fast.",
    },
    {
      icon: Lock,
      title: "Uncompromising Security",
      description: "Row-level security, end-to-end encryption, and secure by default architecture. Security at every layer.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Create your account",
      description: "Sign up with just your email using our secure magic link authentication.",
    },
    {
      number: "02",
      title: "Add your passwords",
      description: "Import from browsers or other password managers. Everything is encrypted instantly.",
    },
    {
      number: "03",
      title: "Access anywhere",
      description: "Your encrypted vault syncs across all your devices seamlessly.",
    },
  ];

  const services = [
    { name: "Google", password: "Tr0ub4dor&3" },
    { name: "GitHub", password: "c0rr3ct-h0rs3-b4tt3ry-st4pl3" },
    { name: "Amazon", password: "Sh0pp!ng@2024" },
    { name: "Netflix", password: "M0vi3N!ght2024" },
    { name: "Stripe", password: "p@ym3nt-s3cur3-k3y" },
    { name: "Notion", password: "n0t3s-0rgan!z3d" },
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
                  Zero-knowledge encryption
                </span>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1 className="mb-6">
                  Your passwords,
                  <br />
                  <span className="text-primary">privately yours.</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-[17px] text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                  A beautiful password manager with built-in 2FA authenticator.
                  Zero-knowledge encryption means we never see your data.
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
                <div className="flex items-center justify-center lg:justify-start gap-6 mt-10 pt-10 border-t border-border/60">
                  <div className="flex items-center gap-1.5 font-accent text-sm text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    <span>AES-256</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-accent text-sm text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Zero-knowledge</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-accent text-sm text-muted-foreground">
                    <Key className="h-3.5 w-3.5" />
                    <span>Open source</span>
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Hero Visual */}
            <FadeIn delay={0.2}>
              <div className="relative">
                {/* Main card */}
                <div className="surface-card p-7">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Shield className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <div className="font-accent font-semibold text-sm">Your Vault</div>
                      <div className="font-accent text-xs text-muted-foreground">6 accounts stored</div>
                    </div>
                  </div>

                  {/* Service cards grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {services.map((service, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.05 }}
                        className="p-3.5 rounded-lg border border-border/50 bg-surface"
                      >
                        <div className="font-accent font-semibold text-xs text-foreground">{service.name}</div>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="text-xs text-muted-foreground font-mono">
                            {visiblePasswords[i] ? service.password : "••••••••"}
                          </div>
                          <button
                            onClick={() => togglePassword(i)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                          >
                            {visiblePasswords[i] ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* OTP preview */}
                  <div className="mt-3 p-3.5 bg-muted/60 border border-border/40 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-accent text-xs text-muted-foreground">Authenticator</span>
                      </div>
                      <div className="text-xl font-mono tracking-[0.15em] text-foreground">482 915</div>
                    </div>
                  </div>
                </div>

                {/* Floating notification */}
                <motion.div
                  initial={{ opacity: 0, x: 20, y: -20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="absolute -right-3 -top-3 surface-card p-3 flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-success" />
                  </div>
                  <div>
                    <div className="font-accent font-semibold text-xs">Code copied</div>
                    <div className="font-accent text-[11px] text-muted-foreground">Just now</div>
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
                Security meets simplicity
              </h2>
              <p className="text-[17px] text-muted-foreground max-w-2xl mx-auto">
                We believe security shouldn't be complicated. Every feature designed with care.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 gap-5">
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
                  Security First
                </span>
                <h2 className="mb-5">
                  We literally can't see your passwords
                </h2>
                <p className="text-[17px] text-muted-foreground mb-8 leading-relaxed">
                  Your passwords are encrypted on your device before they ever reach our servers.
                  The encryption key never leaves your device. We built it so we can't access your data.
                </p>

                <div className="space-y-3">
                  {[
                    "AES-256 encryption for all data",
                    "Master key never leaves your device",
                    "Open-source cryptography libraries",
                    "Regular security audits",
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
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
              <div className="surface-card p-8 sm:p-12">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Lock className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl mb-2">End-to-end encrypted</h3>
                  <p className="text-[15px] text-muted-foreground">
                    Your data is encrypted before it leaves your device
                  </p>
                  <div className="mt-8 pt-8 border-t border-border/60">
                    <div className="font-mono text-4xl font-semibold text-primary mb-1">256-bit</div>
                    <div className="font-accent text-sm text-muted-foreground">AES encryption</div>
                  </div>
                </div>
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
              Ready to secure your digital life?
            </h2>
            <p className="text-[17px] text-muted-foreground mb-10 max-w-xl mx-auto">
              Join thousands who trust Vault with their most sensitive data.
              Free to start, secure forever.
            </p>
            <Link
              href="/auth/login"
              className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 text-base h-auto"
            >
              Create Your Free Account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="flex items-center justify-center gap-6 mt-8 font-accent text-sm text-muted-foreground">
              <span>Free forever plan</span>
              <span>·</span>
              <span>No credit card required</span>
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
              © {new Date().getFullYear()} Vault. Your passwords, privately yours.
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

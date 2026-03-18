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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Lock className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg">Vault</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/auth/login"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 sm:pt-40 sm:pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Hero Content */}
            <div className="text-center lg:text-left">
              <FadeIn delay={0}>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Sparkles className="h-4 w-4" />
                  Zero-knowledge encryption
                </span>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight leading-[1.15] mb-6">
                  Your passwords,
                  <br />
                  <span className="text-primary">privately yours.</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                  A beautiful password manager with built-in 2FA authenticator.
                  Zero-knowledge encryption means we never see your data.
                </p>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#features"
                    className="inline-flex items-center justify-center px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
                  >
                    Learn More
                  </a>
                </div>
              </FadeIn>

              {/* Trust indicators */}
              <FadeIn delay={0.4}>
                <div className="flex items-center justify-center lg:justify-start gap-6 mt-10 pt-10 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>AES-256</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span>Zero-knowledge</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Key className="h-4 w-4" />
                    <span>Open source</span>
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Hero Visual */}
            <FadeIn delay={0.2}>
              <div className="relative">
                {/* Main card */}
                <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Your Vault</div>
                      <div className="text-sm text-muted-foreground">6 accounts stored</div>
                    </div>
                  </div>

                  {/* Service cards grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {services.map((service, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.05 }}
                        className="p-4 rounded-xl border border-border bg-card"
                      >
                        <div className="font-medium text-sm text-foreground">{service.name}</div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-xs text-muted-foreground font-mono">
                            {visiblePasswords[i] ? service.password : "••••••••"}
                          </div>
                          <button
                            onClick={() => togglePassword(i)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                          >
                            {visiblePasswords[i] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* OTP preview */}
                  <div className="mt-4 p-4 bg-muted rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Google Authenticator</span>
                      </div>
                      <div className="text-2xl font-mono tracking-wider">482 915</div>
                    </div>
                  </div>
                </div>

                {/* Floating notification */}
                <motion.div
                  initial={{ opacity: 0, x: 20, y: -20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="absolute -right-4 -top-4 bg-card border border-border rounded-xl shadow-md p-4 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <Check className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Code copied</div>
                    <div className="text-xs text-muted-foreground">Just now</div>
                  </div>
                </motion.div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-display tracking-tight mb-4">
                Security meets simplicity
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                We believe security shouldn't be complicated. Every feature designed with care.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <ScrollReveal key={i}>
                <div className="group p-6 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-display mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
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
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-display tracking-tight mb-4">
                Get started in seconds
              </h2>
              <p className="text-lg text-muted-foreground">
                No credit card required. No complicated setup.
              </p>
            </div>
          </ScrollReveal>

          <div className="space-y-4">
            {steps.map((step, i) => (
              <ScrollReveal key={i}>
                <div className="flex gap-6 p-6 bg-card border border-border rounded-xl">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-display font-semibold">{step.number}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-display mb-1">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 sm:py-32 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <ScrollReveal>
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Shield className="h-4 w-4" />
                  Security First
                </span>
                <h2 className="text-3xl sm:text-4xl font-display tracking-tight mb-6">
                  We literally can't see your passwords
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Your passwords are encrypted on your device before they ever reach our servers.
                  The encryption key never leaves your device. We built it so we can't access your data.
                </p>

                <div className="space-y-4">
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
                      <span className="text-muted-foreground">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal>
              <div className="bg-card border border-border rounded-2xl shadow-sm p-8 sm:p-12">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Lock className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-display mb-2">End-to-end encrypted</h3>
                  <p className="text-muted-foreground">
                    Your data is encrypted before it leaves your device
                  </p>
                  <div className="mt-8 pt-8 border-t border-border">
                    <div className="text-4xl font-mono font-semibold text-primary mb-1">256-bit</div>
                    <div className="text-sm text-muted-foreground">AES encryption</div>
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
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display tracking-tight mb-6">
              Ready to secure your digital life?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Join thousands who trust Vault with their most sensitive data.
              Free to start, secure forever.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-medium text-lg hover:opacity-90 transition-opacity"
            >
              Create Your Free Account
              <ArrowRight className="h-5 w-5" />
            </Link>
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <span>Free forever plan</span>
              <span>•</span>
              <span>No credit card required</span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Lock className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display">Vault</span>
            </div>

            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Vault. Your passwords, privately yours.
            </p>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Security
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

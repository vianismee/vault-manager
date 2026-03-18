"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, Lock, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "magic" | "password" | "signup";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<AuthMode>("magic");
  const router = useRouter();
  const { toast } = useToast();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: "Check your inbox",
        description: "We sent you a magic link to sign in.",
      });
    } catch (error: any) {
      let title = "Unable to send link";
      let description = error.message || "Please try again later";

      // Handle rate limit errors
      if (error.message?.includes("rate limit") || error.message?.includes("too many")) {
        title = "Too many requests";
        description = "You've requested too many magic links. Please wait a few minutes before trying again.";
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back",
        description: "You're now signed in.",
      });

      router.push("/vault");
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      toast({
        title: "Account created",
        description: "Please check your email to verify your account.",
      });

      setMode("magic");
      setSent(true);
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen min-h-dvh bg-background flex-col">
      {/* Header */}
      <header className="border-b border-border/40 py-4 pt-safe-top shrink-0">
        <div className="flex items-center justify-center gap-2 max-w-[420px] mx-auto px-5">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/20">
            <Lock className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg tracking-tight">Vault</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-5 py-4 sm:py-12 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-[420px] mx-auto"
        >
          <div className="mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-display mb-2">
              {mode === "signup" ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {mode === "signup"
                ? "Sign up to get started with your secure password vault"
                : "Sign in to access your secure password vault"}
            </p>
          </div>

          <div className="card-elevated p-6 sm:p-8">
            {!sent ? (
              <>
                {/* Auth Mode Tabs */}
                {mode !== "signup" && (
                  <div className="flex gap-1.5 p-1 bg-muted/50 rounded-lg mb-6">
                    <button
                      type="button"
                      onClick={() => setMode("magic")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 sm:px-4 rounded-md text-sm font-medium transition-all ${
                        mode === "magic"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      <span className="hidden sm:inline">Magic link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("password")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 sm:px-4 rounded-md text-sm font-medium transition-all ${
                        mode === "password"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      <Lock className="h-4 w-4" />
                      <span className="hidden sm:inline">Password</span>
                    </button>
                  </div>
                )}

                {/* Magic Link Form */}
                <AnimatePresence mode="wait">
                  {mode === "magic" && (
                    <motion.form
                      key="magic"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 4 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handleMagicLink}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="input-clean"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full btn-primary"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Send magic link
                          </>
                        )}
                      </Button>
                    </motion.form>
                  )}

                  {/* Password Sign In Form */}
                  {mode === "password" && (
                    <motion.form
                      key="password"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 4 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handlePasswordSignIn}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="input-clean"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Password</label>
                        <Input
                          type="password"
                          placeholder="•••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="input-clean"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full btn-primary"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => setMode("signup")}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Don't have an account? <span className="text-primary font-medium">Sign up</span>
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {/* Sign Up Form */}
                  {mode === "signup" && (
                    <motion.form
                      key="signup"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 4 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handleSignUp}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium mb-2">Full name</label>
                        <Input
                          type="text"
                          placeholder="John Doe"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="input-clean"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="input-clean"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Password</label>
                        <Input
                          type="password"
                          placeholder="•••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="input-clean"
                        />
                        <p className="text-xs text-muted-foreground mt-1.5">Minimum 6 characters</p>
                      </div>
                      <Button
                        type="submit"
                        className="w-full btn-primary"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <User className="mr-2 h-4 w-4" />
                            Create account
                          </>
                        )}
                      </Button>
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => setMode("password")}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Already have an account? <span className="text-primary font-medium">Sign in</span>
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-5">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-display mb-2">Check your email</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  We sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSent(false);
                    setMode("magic");
                  }}
                  className="w-full mt-6"
                >
                  Use different email
                </Button>
              </motion.div>
            )}
          </div>

          {/* Footer text */}
          <p className="text-center text-xs text-muted-foreground mt-6 pb-safe-bottom">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { isMobile } from "@/lib/mobile";

/**
 * PWA Entry Point
 *
 * This page serves as the entry point for the installed PWA.
 * It handles the initial routing based on authentication state.
 */
export default function PwaAppPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Not authenticated - go to login
        router.replace("/auth/login");
      } else {
        // Authenticated - route to appropriate vault page
        if (isMobile()) {
          router.replace("/vault/mobile");
        } else {
          router.replace("/vault");
        }
      }
    };

    checkAuth();
  }, [router]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading Vault...</p>
      </div>
    </div>
  );
}

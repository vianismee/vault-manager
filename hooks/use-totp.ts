"use client";

import { useState, useEffect, useCallback } from "react";
import { generateTOTP } from "@/lib/totp";

export function useTOTP(secret?: string) {
  const [token, setToken] = useState<string>("");
  const [remaining, setRemaining] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(true);

  const generateToken = useCallback(() => {
    if (!secret) {
      setIsLoading(false);
      return;
    }

    const result = generateTOTP(secret);
    if (result) {
      setToken(result.token);
      setRemaining(result.remaining);
    }
    setIsLoading(false);
  }, [secret]);

  useEffect(() => {
    generateToken();

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          generateToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [generateToken]);

  return { token, remaining, isLoading };
}

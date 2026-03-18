/**
 * Rate Limit Status Component
 * Shows users how many email requests they have remaining
 */

"use client";

import { Clock, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface RateLimitStatusProps {
  email: string;
  type?: string;
  className?: string;
}

export function RateLimitStatus({ email, type = "magic", className = "" }: RateLimitStatusProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resetTime, setResetTime] = useState<Date | null>(null);

  useEffect(() => {
    if (!email) return;

    // In a real app, fetch from API
    // For now, we'll simulate or check localStorage
    const checkRateLimit = () => {
      const key = `rateLimit:${type}:${email}`;
      const stored = localStorage.getItem(key);

      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();

        if (data.resetAt > now) {
          setRemaining(Math.max(0, 3 - data.count));
          setResetTime(new Date(data.resetAt));
        } else {
          localStorage.removeItem(key);
          setRemaining(3);
          setResetTime(null);
        }
      } else {
        setRemaining(3);
      }
    };

    checkRateLimit();
    const interval = setInterval(checkRateLimit, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [email, type]);

  if (remaining === null) return null;

  const isLimited = remaining === 0;

  return (
    <div className={`flex items-center gap-2 text-xs ${isLimited ? "text-orange-600" : "text-muted-foreground"} ${className}`}>
      {isLimited ? (
        <>
          <AlertCircle className="h-3.5 w-3.5" />
          <span>
            {resetTime && `Too many requests. Try again after ${resetTime.toLocaleTimeString()}`}
          </span>
        </>
      ) : (
        <>
          <Clock className="h-3.5 w-3.5" />
          <span>{remaining} email requests remaining</span>
        </>
      )}
    </div>
  );
}

/**
 * Use this component in your login form:

import { RateLimitStatus } from "@/components/rate-limit-status";

<RateLimitStatus email={email} type="magic" className="mt-3" />
*/

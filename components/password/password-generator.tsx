"use client";

import { useState, useCallback } from "react";
import { Copy, Check, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PasswordGeneratorProps {
  onPasswordGenerated?: (password: string) => void;
  className?: string;
}

export function PasswordGenerator({ onPasswordGenerated, className }: PasswordGeneratorProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [length, setLength] = useState(16);
  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  const generatePassword = useCallback(() => {
    const chars = {
      uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      lowercase: "abcdefghijklmnopqrstuvwxyz",
      numbers: "0123456789",
      symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
    };

    let availableChars = "";
    let guaranteedChars = "";

    if (options.uppercase) {
      availableChars += chars.uppercase;
      guaranteedChars += chars.uppercase[Math.floor(Math.random() * chars.uppercase.length)];
    }
    if (options.lowercase) {
      availableChars += chars.lowercase;
      guaranteedChars += chars.lowercase[Math.floor(Math.random() * chars.lowercase.length)];
    }
    if (options.numbers) {
      availableChars += chars.numbers;
      guaranteedChars += chars.numbers[Math.floor(Math.random() * chars.numbers.length)];
    }
    if (options.symbols) {
      availableChars += chars.symbols;
      guaranteedChars += chars.symbols[Math.floor(Math.random() * chars.symbols.length)];
    }

    if (availableChars === "") {
      setPassword("");
      return;
    }

    let result = guaranteedChars;
    for (let i = guaranteedChars.length; i < length; i++) {
      result += availableChars[Math.floor(Math.random() * availableChars.length)];
    }

    // Shuffle the result
    const shuffled = result.split("").sort(() => Math.random() - 0.5).join("");
    setPassword(shuffled);
    onPasswordGenerated?.(shuffled);
  }, [length, options, onPasswordGenerated]);

  const handleCopy = async () => {
    if (password) {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Password copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const strength = getPasswordStrength(password);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Password Display */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Generate a password"
            className="input-clean pr-20 font-mono text-sm"
            readOnly
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={generatePassword}
          className="h-11 w-11 flex-shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
          disabled={!password}
          className="h-11 w-11 flex-shrink-0"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* Strength Indicator */}
      {password && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Strength
            </span>
            <span className={cn("text-xs font-medium", strength.color)}>
              {strength.label}
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", strength.bgColor)}
              style={{ width: `${strength.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Length Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Length</label>
          <span className="text-sm text-muted-foreground">{length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={32}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Character Options */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
          <input
            type="checkbox"
            checked={options.uppercase}
            onChange={(e) => setOptions({ ...options, uppercase: e.target.checked })}
            className="h-4 w-4 rounded border-border/60 text-primary focus:ring-2 focus:ring-ring/20"
          />
          <span className="text-sm">ABC</span>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
          <input
            type="checkbox"
            checked={options.lowercase}
            onChange={(e) => setOptions({ ...options, lowercase: e.target.checked })}
            className="h-4 w-4 rounded border-border/60 text-primary focus:ring-2 focus:ring-ring/20"
          />
          <span className="text-sm">abc</span>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
          <input
            type="checkbox"
            checked={options.numbers}
            onChange={(e) => setOptions({ ...options, numbers: e.target.checked })}
            className="h-4 w-4 rounded border-border/60 text-primary focus:ring-2 focus:ring-ring/20"
          />
          <span className="text-sm">123</span>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
          <input
            type="checkbox"
            checked={options.symbols}
            onChange={(e) => setOptions({ ...options, symbols: e.target.checked })}
            className="h-4 w-4 rounded border-border/60 text-primary focus:ring-2 focus:ring-ring/20"
          />
          <span className="text-sm">@#$</span>
        </label>
      </div>

      {/* Generate Button */}
      <Button
        type="button"
        onClick={generatePassword}
        className="w-full btn-primary"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Generate Password
      </Button>
    </div>
  );
}

export interface StrengthResult {
  label: string;
  color: string;
  bgColor: string;
  percent: number;
}

export function getPasswordStrength(password: string): StrengthResult {
  if (!password) {
    return { label: "", color: "", bgColor: "", percent: 0 };
  }

  let score = 0;

  // Length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  score += varietyCount - 1;

  // Max score is 6
  if (score <= 2) {
    return {
      label: "Weak",
      color: "text-destructive",
      bgColor: "bg-destructive",
      percent: 25,
    };
  }
  if (score <= 3) {
    return {
      label: "Fair",
      color: "text-warning",
      bgColor: "bg-warning",
      percent: 50,
    };
  }
  if (score <= 4) {
    return {
      label: "Good",
      color: "text-info",
      bgColor: "bg-info",
      percent: 75,
    };
  }
  return {
    label: "Strong",
    color: "text-success",
    bgColor: "bg-success",
    percent: 100,
  };
}

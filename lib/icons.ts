/**
 * Website icon fetching utility
 * Uses multiple sources with fallbacks for getting website favicons
 */

import React from "react";

export interface IconOptions {
  size?: number;
  preferDark?: boolean;
}

/**
 * Get favicon URL for a website with multiple fallback sources
 */
export function getFaviconUrl(
  url: string,
  options: IconOptions = {}
): string | null {
  const { size = 64 } = options;

  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace(/^www\./, "");

    // DuckDuckGo (most reliable, no rate limiting)
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch {
    return null;
  }
}

/**
 * Generate a colored placeholder for websites without favicons
 */
export function generatePlaceholder(title: string, preferDark: boolean = false): {
  background: string;
  initial: string;
  color: string;
} {
  const colors = [
    { bg: "hsl(10, 60%, 95%)", text: "hsl(10, 60%, 45%)" },   // Coral
    { bg: "hsl(199, 89%, 95%)", text: "hsl(199, 89%, 45%)" }, // Blue
    { bg: "hsl(142, 76%, 95%)", text: "hsl(142, 76%, 40%)" }, // Green
    { bg: "hsl(38, 92%, 95%)", text: "hsl(38, 92%, 45%)" },   // Yellow
    { bg: "hsl(266, 80%, 95%)", text: "hsl(266, 80%, 45%)" }, // Purple
    { bg: "hsl(340, 75%, 95%)", text: "hsl(340, 75%, 45%)" }, // Pink
  ];

  // Generate consistent index from title
  const index = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const color = colors[index];

  if (preferDark) {
    return {
      background: `hsl(${10 + (index * 30)}, 50%, 20%)`,
      initial: title.charAt(0).toUpperCase(),
      color: `hsl(45, 20%, 92%)`,
    };
  }

  return {
    background: color.bg,
    initial: title.charAt(0).toUpperCase(),
    color: color.text,
  };
}

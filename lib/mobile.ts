/**
 * Mobile detection utilities
 */

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;

  // Check user agent
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  if (isMobileUserAgent(userAgent)) return true;

  // Check screen width (for tablets and small screens)
  if (window.innerWidth <= 768) return true;

  // Check touch capability
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
    return true;
  }

  return false;
}

export function isMobileSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(ad|hone|od).+Version\/[\d.]+.*Safari/i.test(ua) || /FxiOS/i.test(ua);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

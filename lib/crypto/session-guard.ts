/**
 * session-guard.ts — Auto-lock, Page Visibility listener, clipboard auto-clear.
 * REQ-013, REQ-014
 */

export type LockCallback = () => void;

export interface SessionGuardOptions {
  /** Auto-lock inactivity timeout in milliseconds (default: 2 minutes) */
  inactivityMs?: number;
  /** Called when vault should lock */
  onLock: LockCallback;
}

const DEFAULT_INACTIVITY_MS = 2 * 60 * 1000; // 2 minutes
const CLIPBOARD_CLEAR_MS = 30 * 1000; // 30 seconds

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

export class SessionGuard {
  private inactivityMs: number;
  private onLock: LockCallback;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private vaultKey: CryptoKey | null = null;
  private clipboardTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private activityHandler: (() => void) | null = null;

  constructor(opts: SessionGuardOptions) {
    this.inactivityMs = opts.inactivityMs ?? DEFAULT_INACTIVITY_MS;
    this.onLock = opts.onLock;
  }

  /**
   * Start session guard after vault is unlocked.
   * Provide the active CryptoKey reference so it can be nullified on lock.
   */
  start(vaultKey: CryptoKey): void {
    this.vaultKey = vaultKey;
    this.resetTimer();
    this.attachListeners();
  }

  /**
   * Stop session guard (call when vault is locked or unmounted).
   */
  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.detachListeners();
    this.vaultKey = null;
  }

  /**
   * Manually lock the vault.
   */
  lock(): void {
    this.vaultKey = null; // nullify CryptoKey reference (REQ-011)
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.onLock();
  }

  /**
   * Reset the inactivity timer (called on user activity).
   */
  resetTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.lock(), this.inactivityMs);
  }

  /**
   * Schedule clipboard auto-clear after 30 seconds (REQ-014).
   * Clears any existing clipboard clear timer first.
   */
  scheduleClipboardClear(): void {
    if (this.clipboardTimer) clearTimeout(this.clipboardTimer);
    this.clipboardTimer = setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch {
        // Clipboard API may not be available in all contexts
      }
      this.clipboardTimer = null;
    }, CLIPBOARD_CLEAR_MS);
  }

  private attachListeners(): void {
    // Page Visibility API — lock on tab hide (REQ-013)
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.lock();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Activity events — reset inactivity timer
    this.activityHandler = () => this.resetTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, this.activityHandler, { passive: true });
    }
  }

  private detachListeners(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.activityHandler) {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, this.activityHandler);
      }
      this.activityHandler = null;
    }
  }
}

/**
 * Create a SessionGuard singleton with default settings.
 */
export function createSessionGuard(opts: SessionGuardOptions): SessionGuard {
  return new SessionGuard(opts);
}

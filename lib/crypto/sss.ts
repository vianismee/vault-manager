/**
 * sss.ts — Shamir's Secret Sharing (GF(256) polynomial interpolation).
 * TASK-028, Phase 4.
 *
 * Splits a BIP-39 seedphrase into n shares with k-of-n threshold.
 * Default: k=3, n=5 — any 3 of 5 shares can reconstruct the seedphrase.
 *
 * Each share is encoded as "x:hexBytes" for safe offline storage.
 */

// ────────────────────────────────────────────────────────────
// GF(2^8) arithmetic — AES irreducible polynomial 0x11b
// ────────────────────────────────────────────────────────────

function gfMul(a: number, b: number): number {
  let result = 0;
  let aa = a & 0xff;
  let bb = b & 0xff;
  for (let i = 0; i < 8; i++) {
    if (bb & 1) result ^= aa;
    const carry = aa & 0x80;
    aa = (aa << 1) & 0xff;
    if (carry) aa ^= 0x1b;
    bb >>= 1;
  }
  return result;
}

function gfPow(base: number, exp: number): number {
  let result = 1;
  let b = base & 0xff;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = gfMul(result, b);
    b = gfMul(b, b);
    e >>= 1;
  }
  return result;
}

function gfInv(a: number): number {
  if (a === 0) throw new Error('GF(256): inverse of 0 undefined');
  return gfPow(a, 254); // Fermat: a^(2^8 - 2) = a^-1 in GF(2^8)
}

function gfDiv(a: number, b: number): number {
  return gfMul(a, gfInv(b));
}

// ────────────────────────────────────────────────────────────
// Polynomial evaluation over GF(256)
// ────────────────────────────────────────────────────────────

function evalPoly(coeffs: Uint8Array, x: number): number {
  let result = 0;
  let xPow = 1;
  for (let i = 0; i < coeffs.length; i++) {
    result ^= gfMul(coeffs[i], xPow);
    xPow = gfMul(xPow, x);
  }
  return result;
}

/**
 * Lagrange basis interpolation to recover f(0) from k (x, y) points over GF(256).
 */
function lagrangeInterpolate(xs: number[], ys: number[]): number {
  let result = 0;
  for (let i = 0; i < xs.length; i++) {
    let num = ys[i];
    let den = 1;
    for (let j = 0; j < xs.length; j++) {
      if (i !== j) {
        num = gfMul(num, xs[j]);
        den = gfMul(den, xs[j] ^ xs[i]); // x_j - x_i = x_j XOR x_i in GF(2)
      }
    }
    result ^= gfDiv(num, den);
  }
  return result;
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/** A Shamir share, encoded as "x:hexBytes" */
export type SSSShare = string;

/**
 * Split a BIP-39 seedphrase into n shares with threshold k.
 *
 * @param seedphrase  BIP-39 mnemonic string
 * @param k  Minimum shares required for reconstruction (default 3)
 * @param n  Total shares to generate (default 5)
 * @returns  Array of n share strings, each formatted as "x:hexBytes"
 */
export function split(seedphrase: string, k = 3, n = 5): SSSShare[] {
  if (k < 2) throw new Error('Threshold k must be ≥ 2');
  if (k > n) throw new Error('Threshold k must be ≤ n');
  if (n > 255) throw new Error('n must be ≤ 255');

  const secret = new TextEncoder().encode(seedphrase.normalize('NFKD'));
  const secretLen = secret.length;

  // Each share: 1 byte x-coordinate + secretLen bytes y-values
  const shareData: Uint8Array[] = Array.from({ length: n }, (_, i) => {
    const s = new Uint8Array(secretLen + 1);
    s[0] = i + 1; // x = 1..n
    return s;
  });

  for (let byteIdx = 0; byteIdx < secretLen; byteIdx++) {
    // Build random degree-(k-1) polynomial with f(0) = secret[byteIdx]
    const coeffs = new Uint8Array(k);
    coeffs[0] = secret[byteIdx];
    crypto.getRandomValues(coeffs.subarray(1));

    for (let si = 0; si < n; si++) {
      shareData[si][byteIdx + 1] = evalPoly(coeffs, si + 1);
    }
  }

  // Zero secret bytes (SEC-004)
  secret.fill(0);

  return shareData.map((s) => {
    const x = s[0];
    const hex = Array.from(s.subarray(1), (b) => b.toString(16).padStart(2, '0')).join('');
    return `${x}:${hex}`;
  });
}

/**
 * Combine k or more shares to recover the original seedphrase.
 *
 * @param shares  Array of share strings (minimum k, format "x:hexBytes")
 * @returns  The original BIP-39 mnemonic string
 */
export function combine(shares: SSSShare[]): string {
  if (shares.length < 2) throw new Error('At least 2 shares required');

  const parsed = shares.map((share) => {
    const colonIdx = share.indexOf(':');
    if (colonIdx < 1) throw new Error(`Invalid share format: "${share}"`);
    const x = parseInt(share.slice(0, colonIdx), 10);
    if (isNaN(x) || x < 1 || x > 255) throw new Error(`Invalid share x: "${share}"`);
    const hex = share.slice(colonIdx + 1);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return { x, bytes };
  });

  const len = parsed[0].bytes.length;
  if (!parsed.every((s) => s.bytes.length === len)) {
    throw new Error('All shares must have equal length');
  }

  const xs = parsed.map((s) => s.x);
  const secretBytes = new Uint8Array(len);

  for (let byteIdx = 0; byteIdx < len; byteIdx++) {
    const ys = parsed.map((s) => s.bytes[byteIdx]);
    secretBytes[byteIdx] = lagrangeInterpolate(xs, ys);
  }

  const result = new TextDecoder().decode(secretBytes);
  secretBytes.fill(0);
  return result;
}

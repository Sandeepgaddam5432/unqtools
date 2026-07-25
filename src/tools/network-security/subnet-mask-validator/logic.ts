/**
 * Subnet Mask Validator — pure logic.
 * Validates subnet masks, converts CIDR <-> dotted decimal, checks bit continuity.
 */

export interface MaskResult {
  input: string;
  isValid: boolean;
  cidr: number | null;
  dotted: string | null;
  wildcard: string | null;
  hostBits: number | null;
  networkBits: number | null;
  totalHosts: number | null;
  usableHosts: number | null;
  errors: string[];
}

/** Parse dotted-quad string into 32-bit unsigned integer. Returns null if invalid. */
export function parseDottedQuad(s: string): number | null {
  const parts = s.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    value = (value << 8) | n;
  }
  // Force unsigned 32-bit
  return value >>> 0;
}

/** Convert 32-bit integer to dotted-quad string. */
export function toDottedQuad(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join(".");
}

/** CIDR (0-32) to mask integer. Returns null if out of range. */
export function cidrToMask(cidr: number): number | null {
  if (!Number.isInteger(cidr) || cidr < 0 || cidr > 32) return null;
  if (cidr === 0) return 0;
  return (0xffffffff << (32 - cidr)) >>> 0;
}

/** Mask integer to CIDR prefix length. Returns null if mask is non-contiguous. */
export function maskToCidr(mask: number): number | null {
  const m = mask >>> 0;
  // Contiguous mask: the complement must be of form 2^k - 1 (a string of trailing 1s).
  // Equivalently: comp & (comp + 1) === 0.
  const comp = (~m) >>> 0;
  if (comp === 0) return 32;
  if ((comp & ((comp + 1) >>> 0)) !== 0) return null;
  let zeros = 0;
  let v = comp;
  while (v !== 0) { zeros++; v >>>= 1; }
  return 32 - zeros;
}

/** Validate a subnet mask given as either CIDR ("24") or dotted-quad ("255.255.255.0"). */
export function validateMask(input: string): MaskResult {
  const trimmed = input.trim();
  const errors: string[] = [];
  if (!trimmed) {
    return { input, isValid: false, cidr: null, dotted: null, wildcard: null, hostBits: null, networkBits: null, totalHosts: null, usableHosts: null, errors: ["Input is empty"] };
  }

  let mask: number | null = null;
  let cidr: number | null = null;

  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    cidr = n >= 0 && n <= 32 ? n : null;
    if (cidr === null) {
      errors.push("CIDR must be between 0 and 32");
    } else {
      mask = cidrToMask(cidr);
    }
  } else if (trimmed.includes(".")) {
    mask = parseDottedQuad(trimmed);
    if (mask === null) {
      errors.push("Invalid dotted-quad format (expected a.b.c.d with bytes 0-255)");
    } else {
      cidr = maskToCidr(mask);
      if (cidr === null) {
        errors.push("Mask is non-contiguous (bits must be 1*0*)");
      }
    }
  } else {
    errors.push("Input must be a CIDR number (0-32) or dotted-quad (a.b.c.d)");
  }

  if (mask === null || cidr === null) {
    return { input, isValid: false, cidr, dotted: mask !== null ? toDottedQuad(mask) : null, wildcard: null, hostBits: null, networkBits: null, totalHosts: null, usableHosts: null, errors };
  }

  const hostBits = 32 - cidr;
  const totalHosts = hostBits >= 31 ? Math.pow(2, hostBits) : Math.pow(2, hostBits);
  const usableHosts = cidr >= 31 ? 0 : Math.max(0, totalHosts - 2);
  const wildcard = (~mask) >>> 0;

  return {
    input,
    isValid: errors.length === 0,
    cidr,
    dotted: toDottedQuad(mask),
    wildcard: toDottedQuad(wildcard),
    hostBits,
    networkBits: cidr,
    totalHosts,
    usableHosts,
    errors,
  };
}

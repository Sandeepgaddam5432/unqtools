/**
 * TOTP/2FA Code Generator — pure logic.
 * RFC 6238 TOTP implementation.
 */

export async function generateTOTP(secret: string, period: number = 30, digits: number = 6, algorithm: string = "SHA-1"): Promise<string> {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / period);
  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  view.setUint32(4, counter);
  if (!crypto?.subtle) throw new Error("WebCrypto not available");
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: algorithm }, false, ["sign"]);
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBytes));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (code % Math.pow(10, digits)).toString().padStart(digits, "0");
}

export function base32Decode(secret: string): Uint8Array {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = secret.replace(/\s+/g, "").toUpperCase().replace(/=/g, "");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = alpha.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(bytes);
}

export function base32Encode(bytes: Uint8Array): string {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += alpha[(value >>> (bits - 5)) & 0x1f]; bits -= 5; }
  }
  if (bits > 0) output += alpha[(value << (5 - bits)) & 0x1f];
  return output;
}

export function getRemainingSeconds(period: number = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}

export function generateSecret(length: number = 20): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base32Encode(bytes);
}

export function parseOtpAuthUri(uri: string): { secret: string; issuer: string; account: string; period: number; digits: number } | null {
  const m = uri.match(/^otpauth:\/\/totp\/([^:?]+)(?:\?([^]*))?$/);
  if (!m) return null;
  const account = decodeURIComponent(m[1]);
  const params = new URLSearchParams(m[2] || "");
  const secret = params.get("secret") || "";
  const issuer = params.get("issuer") || "";
  const period = parseInt(params.get("period") || "30", 10);
  const digits = parseInt(params.get("digits") || "6", 10);
  return { secret, issuer, account, period, digits };
}

export function buildOtpAuthUri(secret: string, account: string, issuer: string = "", period: number = 30, digits: number = 6): string {
  const params = new URLSearchParams({ secret, period: String(period), digits: String(digits) });
  if (issuer) params.set("issuer", issuer);
  return `otpauth://totp/${encodeURIComponent(account)}?${params.toString()}`;
}

/**
 * Cryptographic Key Generator (AES/RSA/ECDSA) — pure logic.
 * Cryptographic key generation using WebCrypto.
 */

export type KeyType = "aes" | "rsa" | "ecdsa" | "ed25519";
export type ExportFormat = "pem" | "jwk" | "raw" | "base64";

export interface KeyGenerationOptions {
  type: KeyType;
  size: number; // AES: 128/192/256, RSA: 2048/4096
  curve?: "P-256" | "P-384" | "P-521"; // for ECDSA
  format: ExportFormat;
}

export async function generateKey(opts: KeyGenerationOptions): Promise<{
  publicKey?: string;
  privateKey?: string;
  raw?: string;
  fingerprint: string;
  algorithm: string;
}> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("WebCrypto not available");
  }

  let fingerprint = "";

  if (opts.type === "aes") {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: opts.size },
      true,
      ["encrypt", "decrypt"]
    );
    const raw = await crypto.subtle.exportKey("raw", key);
    const rawBytes = new Uint8Array(raw);
    fingerprint = await sha256Hex(rawBytes);
    const rawStr = Array.from(rawBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    return {
      raw: opts.format === "base64" ? bytesToBase64(rawBytes) : rawStr,
      fingerprint,
      algorithm: `AES-${opts.size}`,
    };
  }

  if (opts.type === "rsa") {
    const keyPair = await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: opts.size, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"]
    );
    const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const pubBytes = new TextEncoder().encode(JSON.stringify(pubJwk));
    fingerprint = await sha256Hex(pubBytes);
    return {
      publicKey: formatExport(pubJwk, opts.format, "public"),
      privateKey: formatExport(privJwk, opts.format, "private"),
      fingerprint,
      algorithm: `RSA-${opts.size}`,
    };
  }

  if (opts.type === "ecdsa" && opts.curve) {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: opts.curve },
      true,
      ["sign", "verify"]
    );
    const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const pubBytes = new TextEncoder().encode(JSON.stringify(pubJwk));
    fingerprint = await sha256Hex(pubBytes);
    return {
      publicKey: formatExport(pubJwk, opts.format, "public"),
      privateKey: formatExport(privJwk, opts.format, "private"),
      fingerprint,
      algorithm: `ECDSA-${opts.curve}`,
    };
  }

  throw new Error(`Unsupported key type: ${opts.type}`);
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function formatExport(jwk: JsonWebKey, format: ExportFormat, kind: "public" | "private"): string {
  if (format === "jwk") return JSON.stringify(jwk, null, 2);
  if (format === "pem") {
    // Convert JWK to base64 (simplified — real PEM requires ASN.1 encoding)
    const json = JSON.stringify(jwk);
    const b64 = btoa(json);
    const lines = b64.match(/.{1,64}/g) || [];
    const header = kind === "public" ? "PUBLIC KEY" : "PRIVATE KEY";
    return `-----BEGIN ${header}-----\n${lines.join("\n")}\n-----END ${header}-----`;
  }
  if (format === "base64") return btoa(JSON.stringify(jwk));
  return JSON.stringify(jwk);
}

export function validateOptions(opts: KeyGenerationOptions): string[] {
  const errors: string[] = [];
  if (opts.type === "aes" && ![128, 192, 256].includes(opts.size)) {
    errors.push("AES key size must be 128, 192, or 256");
  }
  if (opts.type === "rsa" && ![2048, 3072, 4096].includes(opts.size)) {
    errors.push("RSA key size must be 2048, 3072, or 4096");
  }
  if (opts.type === "ecdsa" && !["P-256", "P-384", "P-521"].includes(opts.curve || "")) {
    errors.push("ECDSA curve must be P-256, P-384, or P-521");
  }
  return errors;
}

export function getKeyTypes(): { value: KeyType; label: string; description: string }[] {
  return [
    { value: "aes", label: "AES", description: "Symmetric encryption (128/192/256-bit)" },
    { value: "rsa", label: "RSA", description: "Asymmetric encryption (2048/4096-bit)" },
    { value: "ecdsa", label: "ECDSA", description: "Elliptic Curve (P-256/P-384/P-521)" },
  ];
}

export function getExportFormats(): { value: ExportFormat; label: string }[] {
  return [
    { value: "pem", label: "PEM" },
    { value: "jwk", label: "JWK (JSON Web Key)" },
    { value: "raw", label: "Raw hex" },
    { value: "base64", label: "Base64" },
  ];
}

/**
 * Hash Identifier — pure logic.
 * Identify hash type by length and character set analysis.
 */

export interface HashTypeInfo {
  name: string;
  bitLength: number;
  hexLength: number;
  description: string;
  examples: string[];
}

export const HASH_TYPES: HashTypeInfo[] = [
  { name: "MD5", bitLength: 128, hexLength: 32, description: "128-bit MD5 — broken, do not use for security.", examples: ["d41d8cd98f00b204e9800998ecf8427e"] },
  { name: "SHA-1", bitLength: 160, hexLength: 40, description: "160-bit SHA-1 — deprecated, broken.", examples: ["da39a3ee5e6b4b0d3255bfef95601890afd80709"] },
  { name: "SHA-224", bitLength: 224, hexLength: 56, description: "224-bit SHA-2 variant.", examples: [] },
  { name: "SHA-256", bitLength: 256, hexLength: 64, description: "256-bit SHA-2 — common and secure.", examples: ["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"] },
  { name: "SHA-384", bitLength: 384, hexLength: 96, description: "384-bit SHA-2 variant.", examples: [] },
  { name: "SHA-512", bitLength: 512, hexLength: 128, description: "512-bit SHA-2 variant.", examples: ["cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"] },
  { name: "SHA-512/224", bitLength: 224, hexLength: 56, description: "Truncated SHA-512 to 224 bits.", examples: [] },
  { name: "SHA-512/256", bitLength: 256, hexLength: 64, description: "Truncated SHA-512 to 256 bits.", examples: [] },
  { name: "SHA3-256", bitLength: 256, hexLength: 64, description: "Keccak-f based SHA-3, 256-bit.", examples: [] },
  { name: "SHA3-512", bitLength: 512, hexLength: 128, description: "Keccak-f based SHA-3, 512-bit.", examples: [] },
  { name: "RIPEMD-160", bitLength: 160, hexLength: 40, description: "160-bit RIPEMD.", examples: [] },
  { name: "Tiger-192", bitLength: 192, hexLength: 48, description: "192-bit Tiger hash.", examples: [] },
  { name: "CRC32", bitLength: 32, hexLength: 8, description: "32-bit CRC checksum — not a cryptographic hash.", examples: [] },
];

export interface IdentificationResult {
  input: string;
  length: number;
  charset: "hex" | "base64" | "unknown";
  possibleTypes: HashTypeInfo[];
  warnings: string[];
}

function detectCharset(s: string): "hex" | "base64" | "unknown" {
  if (/^[0-9a-fA-F]+$/.test(s)) return "hex";
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return "base64";
  return "unknown";
}

export function identify(input: string): IdentificationResult {
  const trimmed = input.trim();
  const warnings: string[] = [];
  const charset = detectCharset(trimmed);
  let length = trimmed.length;

  if (!trimmed) {
    return { input: trimmed, length: 0, charset: "unknown", possibleTypes: [], warnings: ["Empty input"] };
  }

  // Special-case bcrypt ($2b$...) before any charset gating.
  if (/^\$2[abxy]\$\d{2}\$/.test(trimmed)) {
    warnings.push("Input looks like a bcrypt hash — bcrypt is identified by its $2b$ prefix, not by length.");
  }

  if (charset === "unknown") {
    return {
      input: trimmed, length, charset, possibleTypes: [],
      warnings: warnings.length > 0
        ? warnings
        : ["Input is not valid hex or base64. Hash identifiers only support these charsets."],
    };
  }

  // For base64, decode to byte length and check.
  let effectiveHexLength = length;
  if (charset === "base64") {
    try {
      const decoded = typeof atob === "function" ? atob(trimmed) : Buffer.from(trimmed, "base64").toString("binary");
      effectiveHexLength = decoded.length * 2;
    } catch {
      warnings.push("Base64 decode failed");
    }
  }

  const possibleTypes = HASH_TYPES.filter((t) => t.hexLength === effectiveHexLength);
  if (possibleTypes.length === 0) {
    warnings.push(`No known hash matches ${effectiveHexLength} hex chars (${effectiveHexLength * 4} bits).`);
  }

  return {
    input: trimmed,
    length,
    charset,
    possibleTypes,
    warnings,
  };
}

export function listAllTypes(): HashTypeInfo[] {
  return [...HASH_TYPES];
}

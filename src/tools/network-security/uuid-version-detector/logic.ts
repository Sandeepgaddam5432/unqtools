/** UUID Version Detector — pure logic. */

export type UuidVersion = 1 | 2 | 3 | 4 | 5 | "nil" | "unknown";

export interface UuidParseResult {
  valid: boolean;
  uuid: string;
  version: UuidVersion;
  variant: "ncs" | "rfc4122" | "microsoft" | "reserved" | "unknown";
  hex: string;
  timestamp?: string; // for v1
  clockSeq?: string;
  node?: string;
  errors: string[];
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function variantFromChar(c: string): UuidParseResult["variant"] {
  const b = parseInt(c, 16);
  if ((b & 0x8) === 0) return "ncs";
  if ((b & 0xc) === 0x8) return "rfc4122";
  if ((b & 0xe) === 0xc) return "microsoft";
  return "reserved";
}

export function parse(uuid: string): UuidParseResult {
  const errors: string[] = [];
  const trimmed = uuid.trim().toLowerCase();
  if (trimmed === NIL_UUID) {
    return { valid: true, uuid: trimmed, version: "nil", variant: "reserved", hex: "0".repeat(32), errors: [] };
  }
  if (!UUID_RE.test(trimmed)) {
    errors.push("Invalid UUID format (expected 8-4-4-4-12 hex digits).");
    return { valid: false, uuid: trimmed, version: "unknown", variant: "unknown", hex: trimmed.replace(/-/g, ""), errors };
  }
  const parts = trimmed.split("-");
  // UUID format: 8-4-4-4-12. Version is the first hex char of the 3rd group (parts[2]).
  const versionHex = parts[2]![0];
  const versionNum = parseInt(versionHex!, 16);
  // Variant is in the first hex char of the 4th group (parts[3]).
  const variantChar = parts[3]![0]!;
  const variant = variantFromChar(variantChar);
  const validVersions: UuidVersion[] = [1, 2, 3, 4, 5];
  const version: UuidVersion = validVersions.includes(versionNum as UuidVersion) ? (versionNum as UuidVersion) : "unknown";
  const result: UuidParseResult = {
    valid: true,
    uuid: trimmed,
    version,
    variant,
    hex: trimmed.replace(/-/g, ""),
    errors: [],
  };
  if (version === 1) {
    // v1: timestamp is 60-bit, low 32 from time_low, mid 16 from time_mid, hi 12 from time_hi_and_version (strip version)
    const timeLow = parts[0]!;
    const timeMid = parts[1]!;
    const timeHi = parts[2]!.slice(1); // strip version nibble
    const ts100ns = parseInt(timeHi + timeMid + timeLow, 16);
    // UUID epoch is 1582-10-15 00:00:00 UTC
    const msSinceEpoch = ts100ns / 10000 - 12219292800000;
    const date = new Date(msSinceEpoch);
    result.timestamp = date.toISOString();
    result.clockSeq = parts[3]!;
    result.node = parts[4]!;
  }
  return result;
}

export function generateV4(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6]! = (bytes[6]! & 0x0f) | 0x40;
  bytes[8]! = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function toCsv(rows: UuidParseResult[]): string {
  const lines = ["UUID,Valid,Version,Variant,Timestamp"];
  for (const r of rows) lines.push(`${r.uuid},${r.valid},${r.version},${r.variant},${r.timestamp ?? ""}`);
  return lines.join("\n");
}

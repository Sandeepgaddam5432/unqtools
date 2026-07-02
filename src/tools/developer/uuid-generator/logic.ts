/**
 * UUID Generator — pure logic.
 *
 * Uses crypto.randomUUID when available (all modern browsers + Node 19+).
 * Falls back to a manual RFC 4122 v4 implementation using crypto.getRandomValues
 * for older environments.
 */

export interface UuidOptions {
  /** Include hyphens (default true). */
  hyphens?: boolean;
  /** Uppercase hex (default false). */
  uppercase?: boolean;
  /** Optional prefix prepended to each UUID (e.g. "0x" or "id-"). */
  prefix?: string;
  /** Optional suffix appended to each UUID. */
  suffix?: string;
  /** Wrap each UUID in braces (default false). */
  braces?: boolean;
}

/** Generate a single RFC 4122 v4 UUID string. */
export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return generateUuidFallback();
}

/** Manual RFC 4122 v4 implementation using crypto.getRandomValues. */
function generateUuidFallback(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version (4) and variant (10xx) bits
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = (b: number) => b.toString(16).padStart(2, "0");
  return `${hex(bytes[0]!)}${hex(bytes[1]!)}${hex(bytes[2]!)}${hex(bytes[3]!)}-${hex(bytes[4]!)}${hex(bytes[5]!)}-${hex(bytes[6]!)}${hex(bytes[7]!)}-${hex(bytes[8]!)}${hex(bytes[9]!)}-${hex(bytes[10]!)}${hex(bytes[11]!)}${hex(bytes[12]!)}${hex(bytes[13]!)}${hex(bytes[14]!)}${hex(bytes[15]!)}`;
}

/** Generate multiple UUIDs. */
export function generateUuids(count: number, options: UuidOptions = {}): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(formatUuid(generateUuid(), options));
  }
  return result;
}

/** Format a UUID per the options. */
export function formatUuid(uuid: string, options: UuidOptions): string {
  let s = uuid;
  if (options.hyphens === false) s = s.replace(/-/g, "");
  if (options.uppercase) s = s.toUpperCase();
  if (options.braces) s = `{${s}}`;
  if (options.prefix) s = options.prefix + s;
  if (options.suffix) s = s + options.suffix;
  return s;
}

/** Validate that a string is a well-formed RFC 4122 UUID. */
export function isValidUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    input.trim(),
  );
}

/** Extract the version (1-5) from a UUID, or null if invalid. */
export function getUuidVersion(input: string): number | null {
  if (!isValidUuid(input)) return null;
  return parseInt(input.trim()[14]!, 16);
}

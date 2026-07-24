/** MAC Address Generator — pure logic. */

export type MacFormat = "colon" | "hyphen" | "none" | "dots";
export type MacCase = "upper" | "lower";

export interface MacOptions {
  format: MacFormat;
  case: MacCase;
  oui?: string; // 6-hex-digit OUI prefix; random if omitted
  locallyAdministered?: boolean;
  multicast?: boolean;
}

export interface MacResult {
  mac: string;
  oui: string;
  warnings: string[];
}

const HEX = "0123456789ABCDEF";

function randomHex(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += HEX[Math.floor(Math.random() * 16)];
  return out;
}

function formatMac(raw: string, format: MacFormat, case_: MacCase): string {
  const cased = case_ === "lower" ? raw.toLowerCase() : raw.toUpperCase();
  switch (format) {
    case "colon": return cased.match(/.{2}/g)!.join(":");
    case "hyphen": return cased.match(/.{2}/g)!.join("-");
    case "none": return cased;
    case "dots": return `${cased.slice(0, 4)}.${cased.slice(4, 8)}.${cased.slice(8, 12)}`;
  }
}

function applyFlags(firstByte: string, locallyAdministered?: boolean, multicast?: boolean): string {
  let b = parseInt(firstByte, 16);
  // Bit 1 (0x02) = locally administered
  // Bit 0 (0x01) = multicast
  if (locallyAdministered) b |= 0x02;
  if (multicast) b |= 0x01;
  return b.toString(16).padStart(2, "0").toUpperCase();
}

export function generate(options: MacOptions): MacResult {
  const warnings: string[] = [];
  let oui = options.oui ?? randomHex(6);
  oui = oui.replace(/[:\-.]/g, "").toUpperCase();
  if (oui.length !== 6 || !/^[0-9A-F]{6}$/.test(oui)) {
    warnings.push(`Invalid OUI "${options.oui ?? ""}" — generated random OUI instead.`);
    oui = randomHex(6);
  }
  // Apply flags to first byte
  const firstByte = applyFlags(oui.slice(0, 2), options.locallyAdministered ?? false, options.multicast ?? false);
  const fullRaw = firstByte + oui.slice(2) + randomHex(6);
  return { mac: formatMac(fullRaw, options.format, options.case), oui: formatMac(oui, "colon", options.case), warnings };
}

export function generateBatch(count: number, options: MacOptions): MacResult[] {
  if (count < 1) return [];
  if (count > 10000) count = 10000;
  return Array.from({ length: count }, () => generate(options));
}

export interface ValidateResult {
  valid: boolean;
  normalized: string;
  oui: string;
  errors: string[];
}

export function validate(mac: string): ValidateResult {
  const errors: string[] = [];
  const cleaned = mac.replace(/[:\-.]/g, "").toUpperCase();
  if (cleaned.length !== 12) errors.push(`MAC must be 12 hex chars (got ${cleaned.length}).`);
  if (!/^[0-9A-F]*$/.test(cleaned)) errors.push("MAC contains non-hex characters.");
  const valid = errors.length === 0;
  return {
    valid,
    normalized: valid ? formatMac(cleaned, "colon", "upper") : cleaned,
    oui: valid ? formatMac(cleaned.slice(0, 6), "colon", "upper") : "",
    errors,
  };
}

export function toCsv(rows: MacResult[]): string {
  const lines = ["MAC,OUI"];
  for (const r of rows) lines.push(`${r.mac},${r.oui}`);
  return lines.join("\n");
}

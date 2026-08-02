/**
 * MAC Address Vendor (OUI) Lookup — pure logic.
 */

export interface VendorInfo {
  input: string;
  normalized: string;
  oui: string;
  vendor: string;
  country: string;
  registry: string;
  isLocallyAdministered: boolean;
  isMulticast: boolean;
  isUniversal: boolean;
  found: boolean;
}

const OUI_DB: Record<string, { vendor: string; country: string; registry: string }> = {
  "00:1A:11": { vendor: "Dell Inc.", country: "US", registry: "MA-L" },
  "00:1B:44": { vendor: "Apple, Inc.", country: "US", registry: "MA-L" },
  "00:50:56": { vendor: "VMware, Inc.", country: "US", registry: "MA-L" },
  "00:0C:29": { vendor: "VMware, Inc.", country: "US", registry: "MA-L" },
  "00:1C:42": { vendor: "Parallels, Inc.", country: "US", registry: "MA-L" },
  "00:15:5D": { vendor: "Microsoft Corporation", country: "US", registry: "MA-L" },
  "00:03:FF": { vendor: "Microsoft Corporation", country: "US", registry: "MA-L" },
  "00:50:F2": { vendor: "Microsoft Corporation", country: "US", registry: "MA-L" },
  "F8:8A:5E": { vendor: "Google, Inc.", country: "US", registry: "MA-L" },
  "FC:FB:FB": { vendor: "Google, Inc.", country: "US", registry: "MA-L" },
  "3C:5A:B4": { vendor: "Google, Inc.", country: "US", registry: "MA-L" },
  "00:1B:54": { vendor: "Cisco Systems, Inc", country: "US", registry: "MA-L" },
  "00:1F:9E": { vendor: "Cisco Systems, Inc", country: "US", registry: "MA-L" },
  "00:25:84": { vendor: "Cisco Systems, Inc", country: "US", registry: "MA-L" },
  "00:12:FB": { vendor: "Samsung Electronics", country: "KR", registry: "MA-L" },
  "00:09:18": { vendor: "Samsung Electronics", country: "KR", registry: "MA-L" },
  "00:02:B3": { vendor: "Intel Corporate", country: "US", registry: "MA-L" },
  "00:0F:1F": { vendor: "Intel Corporate", country: "US", registry: "MA-L" },
  "00:13:02": { vendor: "Intel Corporate", country: "US", registry: "MA-L" },
  "00:1F:33": { vendor: "Netgear", country: "US", registry: "MA-L" },
  "00:1B:2F": { vendor: "Netgear", country: "US", registry: "MA-L" },
  "00:0F:B5": { vendor: "Netgear", country: "US", registry: "MA-L" },
  "00:0A:EB": { vendor: "TP-Link Technologies", country: "CN", registry: "MA-L" },
  "00:13:46": { vendor: "TP-Link Technologies", country: "CN", registry: "MA-L" },
  "00:25:9E": { vendor: "Huawei Technologies", country: "CN", registry: "MA-L" },
  "00:18:82": { vendor: "Huawei Technologies", country: "CN", registry: "MA-L" },
  "00:01:AE": { vendor: "Sony Corporation", country: "JP", registry: "MA-L" },
  "00:09:BF": { vendor: "Nintendo Co., Ltd.", country: "JP", registry: "MA-L" },
  "00:17:AB": { vendor: "Nintendo Co., Ltd.", country: "JP", registry: "MA-L" },
  "08:00:20": { vendor: "Sun Microsystems, Inc", country: "US", registry: "MA-L" },
  "00:80:5F": { vendor: "IBM", country: "US", registry: "MA-L" },
};

export function normalizeMac(mac: string): string {
  return mac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
}

export function formatMac(mac: string, format: "colon" | "dash" | "dot" | "none"): string {
  const hex = normalizeMac(mac);
  if (hex.length < 6) return mac;
  const pairs: string[] = [];
  for (let i = 0; i < hex.length; i += 2) pairs.push(hex.slice(i, i + 2));
  switch (format) {
    case "colon": return pairs.join(":");
    case "dash": return pairs.join("-");
    case "dot": return [hex.slice(0, 4), hex.slice(4, 8), hex.slice(8, 12)].filter(Boolean).join(".");
    case "none": return hex;
  }
}

export function extractOui(mac: string): string {
  const hex = normalizeMac(mac);
  if (hex.length < 6) return "";
  return `${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}`;
}

export function isLocallyAdministered(mac: string): boolean {
  const hex = normalizeMac(mac);
  if (hex.length < 2) return false;
  return (parseInt(hex.slice(0, 2), 16) & 0x02) !== 0;
}

export function isMulticast(mac: string): boolean {
  const hex = normalizeMac(mac);
  if (hex.length < 2) return false;
  return (parseInt(hex.slice(0, 2), 16) & 0x01) !== 0;
}

export function lookupMac(mac: string): VendorInfo {
  const normalized = normalizeMac(mac);
  const oui = extractOui(mac);
  const record = OUI_DB[oui];
  return {
    input: mac,
    normalized,
    oui,
    vendor: record?.vendor || "Unknown",
    country: record?.country || "",
    registry: record?.registry || "",
    isLocallyAdministered: isLocallyAdministered(mac),
    isMulticast: isMulticast(mac),
    isUniversal: !isLocallyAdministered(mac),
    found: !!record,
  };
}

export function bulkLookup(macs: string): VendorInfo[] {
  return macs.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(lookupMac);
}

export function reverseLookup(vendor: string): string[] {
  const v = vendor.toLowerCase();
  return Object.entries(OUI_DB).filter(([, info]) => info.vendor.toLowerCase().includes(v)).map(([oui]) => oui);
}

export function generateRandomMac(locallyAdministered: boolean = false): string {
  const prefix = "00:00:00";
  const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()).join("");
  let hex = normalizeMac(prefix) + suffix;
  if (locallyAdministered) {
    const firstByte = parseInt(hex.slice(0, 2), 16);
    hex = (firstByte | 0x02).toString(16).padStart(2, "0").toUpperCase() + hex.slice(2);
  }
  return formatMac(hex, "colon");
}

export function isValidMac(mac: string): boolean {
  const hex = normalizeMac(mac);
  return hex.length >= 12 && /^[0-9A-F]{12}$/i.test(hex);
}

export function exportResults(results: VendorInfo[], format: "json" | "csv"): string {
  if (format === "json") return JSON.stringify(results, null, 2);
  const rows = [["MAC", "OUI", "Vendor", "Country", "Registry"]];
  for (const r of results) rows.push([r.input, r.oui, r.vendor, r.country, r.registry]);
  return rows.map((r) => r.join(",")).join("\n");
}

export function getAllVendors(): { name: string; oui: string }[] {
  const seen = new Map<string, string>();
  for (const [oui, info] of Object.entries(OUI_DB)) {
    if (!seen.has(info.vendor)) seen.set(info.vendor, oui);
  }
  return Array.from(seen.entries()).map(([name, oui]) => ({ name, oui })).sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = formatMac(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}

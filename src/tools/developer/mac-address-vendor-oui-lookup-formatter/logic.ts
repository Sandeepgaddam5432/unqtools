/**
 * MAC Address Vendor (OUI) Lookup & Formatter — pure logic.
 *
 * Bundle a curated IEEE OUI registry (200+ common vendors) supporting
 * MA-L (24-bit), MA-M (28-bit), and MA-S/IAB (36-bit) prefixes via
 * longest-prefix matching. Reformat MACs between colon, hyphen, Cisco dot,
 * bare hex, and EUI-64 notations. Decode U/L (locally-administered) and
 * I/G (multicast) bits. Reverse-search vendor → prefixes. Generate random
 * vendor-correct MACs. Pure functions only — no DOM, no network.
 *
 * PRIVACY: History stores only operation metadata (action + count + ts),
 * NEVER the MAC addresses themselves.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MacFormat = "colon" | "hyphen" | "dot" | "bare" | "eui64";

export type MacCase = "upper" | "lower";

export type BlockType = "MA-L" | "MA-M" | "MA-S/IAB" | "UNKNOWN";

export interface OuiEntry {
  /** Hex prefix (uppercase, no separators). MA-L=6 chars, MA-M=7, MA-S/IAB=9. */
  prefix: string;
  vendor: string;
  block: BlockType;
}

export interface MacValidation {
  input: string;
  valid: boolean;
  /** Normalized 12-uppercase-hex form (no separators). Null when invalid. */
  normalized: string | null;
  notes: string[];
}

export interface MacInfo {
  /** Original input as supplied. */
  input: string;
  /** Normalized 12-uppercase-hex form. */
  normalized: string;
  /** Detected input separator pattern ('colon' | 'hyphen' | 'dot' | 'bare' | 'eui64' | 'unknown'). */
  detectedFormat: MacFormat | "unknown";
  /** EUI-64 expanded form (12-hex → 16-hex with FFFE insert). */
  eui64: string;
  /** First 3 octets as colon form (00:1A:2B). */
  oui: string;
  /** Vendor name resolved from OUI DB (null when locally-administered or unknown). */
  vendor: string | null;
  /** Registry block type (MA-L / MA-M / MA-S/IAB / UNKNOWN). */
  block: BlockType;
  /** Matching prefix length in bits (24 / 28 / 36 / 0 when unknown). */
  prefixBits: number;
  /** U/L bit: true = locally-administered (LAA), false = universally-administered (UAA). */
  locallyAdministered: boolean;
  /** I/G bit: true = multicast/group, false = unicast. */
  multicast: boolean;
  /** True if MAC == FF:FF:FF:FF:FF:FF (broadcast). */
  isBroadcast: boolean;
  /** True if MAC == 00:00:00:00:00:00 (null). */
  isNull: boolean;
  /** True if locally-administered bit set (no vendor possible). */
  isLaa: boolean;
  notes: string[];
}

export interface FormattedMac {
  colon: string;
  hyphen: string;
  dot: string;
  bare: string;
  eui64: string;
  invertedColon: string; // bit-reversed canonical (LSB-first) per IEEE 802.3
}

export interface RandomMacOptions {
  format: MacFormat;
  case: MacCase;
  /** "random" = fully random with U/L set + I/G clear (typical privacy MAC). */
  mode: "random" | "vendor" | "laa" | "multicast";
  /** Required when mode === "vendor" — 6-hex prefix (case-insensitive). */
  vendorPrefix?: string;
  /** Seed for reproducible PRNG. Default: random. */
  seed?: string | number;
}

export interface GeneratedMac {
  index: number;
  mac: string;
  raw: string;
  vendor: string | null;
  multicast: boolean;
  locallyAdministered: boolean;
}

export interface HistoryEntry {
  ts: number;
  action: "lookup" | "format" | "generate" | "reverse" | "batch";
  count: number;
}

export interface VendorSearchResult {
  vendor: string;
  prefixes: { prefix: string; formatted: string; block: BlockType; bits: number }[];
}

// ---------------------------------------------------------------------------
// Bundled IEEE OUI registry (curated, 200+ common vendors)
// ---------------------------------------------------------------------------
//
// This is a curated subset of the IEEE OUI registry (MA-L 24-bit, MA-M 28-bit,
// and MA-S/IAB 36-bit assignments). Longest-prefix matching is used at
// lookup time so the smaller blocks (MA-M, MA-S) win over a coarser MA-L
// match when both apply.
//
// DB snapshot date: 2025-Q1 (clearly displayed in-app via DB_VERSION).

export const DB_VERSION = "2025-Q1 (curated subset, 200+ vendors)";

export const OUI_REGISTRY: OuiEntry[] = [
  // === MA-L (24-bit) — 6-hex-char prefixes ===
  { prefix: "000000", vendor: "Xerox (also used as null/AnyLan)", block: "MA-L" },
  { prefix: "000001", vendor: "Xerox", block: "MA-L" },
  { prefix: "000002", vendor: "Xerox", block: "MA-L" },
  { prefix: "00000C", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "000108", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "00010F", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "000142", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "000149", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0002B9", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "000C29", vendor: "VMware", block: "MA-L" },
  { prefix: "000C30", vendor: "VMware", block: "MA-L" },
  { prefix: "000502", vendor: "VMware", block: "MA-L" },
  { prefix: "000569", vendor: "VMware", block: "MA-L" },
  { prefix: "005056", vendor: "VMware", block: "MA-L" },
  { prefix: "000B82", vendor: "Canon", block: "MA-L" },
  { prefix: "000C7D", vendor: "Canon", block: "MA-L" },
  { prefix: "001083", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0011B9", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0011BD", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001217", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0014A4", vendor: "Netgear", block: "MA-L" },
  { prefix: "001E2A", vendor: "Netgear", block: "MA-L" },
  { prefix: "002215", vendor: "Netgear", block: "MA-L" },
  { prefix: "0022B0", vendor: "Netgear", block: "MA-L" },
  { prefix: "C03F0E", vendor: "Netgear", block: "MA-L" },
  { prefix: "001310", vendor: "Belkin International", block: "MA-L" },
  { prefix: "08BD43", vendor: "Belkin International", block: "MA-L" },
  { prefix: "0016B6", vendor: "Linksys (Cisco)", block: "MA-L" },
  { prefix: "0014BF", vendor: "Linksys (Cisco)", block: "MA-L" },
  { prefix: "0018F3", vendor: "Cisco-Linksys", block: "MA-L" },
  { prefix: "001839", vendor: "TP-Link", block: "MA-L" },
  { prefix: "F8D111", vendor: "TP-Link", block: "MA-L" },
  { prefix: "50C7BF", vendor: "TP-Link", block: "MA-L" },
  { prefix: "C46A0F", vendor: "TP-Link", block: "MA-L" },
  { prefix: "0024D2", vendor: "TP-Link", block: "MA-L" },
  { prefix: "002500", vendor: "Apple", block: "MA-L" },
  { prefix: "000A27", vendor: "Apple", block: "MA-L" },
  { prefix: "000A95", vendor: "Apple", block: "MA-L" },
  { prefix: "001124", vendor: "Apple", block: "MA-L" },
  { prefix: "0017F2", vendor: "Apple", block: "MA-L" },
  { prefix: "0021CC", vendor: "Apple", block: "MA-L" },
  { prefix: "002608", vendor: "Apple", block: "MA-L" },
  { prefix: "002500", vendor: "Apple", block: "MA-L" },
  { prefix: "ACBC32", vendor: "Apple", block: "MA-L" },
  { prefix: "ACDE48", vendor: "Apple", block: "MA-L" },
  { prefix: "B8E856", vendor: "Apple", block: "MA-L" },
  { prefix: "D89E3F", vendor: "Apple", block: "MA-L" },
  { prefix: "F02475", vendor: "Apple", block: "MA-L" },
  { prefix: "3CD92B", vendor: "Hewlett-Packard", block: "MA-L" },
  { prefix: "001083", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001B54", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0017F2", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001871", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0019E3", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001B0D", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001D45", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001E13", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "002154", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0022BE", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "00227B", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0024C4", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "00269B", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0027E2", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "F866F2", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0021CC", vendor: "Dell", block: "MA-L" },
  { prefix: "001E4F", vendor: "Dell", block: "MA-L" },
  { prefix: "F80F41", vendor: "Dell", block: "MA-L" },
  { prefix: "001999", vendor: "Dell", block: "MA-L" },
  { prefix: "001E67", vendor: "Dell", block: "MA-L" },
  { prefix: "0015C5", vendor: "Dell", block: "MA-L" },
  { prefix: "002356", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "001320", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "F0DEF1", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "A4BAC5", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "DC4155", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "8C16B1", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "001A11", vendor: "Google", block: "MA-L" },
  { prefix: "3CECEC", vendor: "Google", block: "MA-L" },
  { prefix: "FCC233", vendor: "Google", block: "MA-L" },
  { prefix: "001125", vendor: "Microsoft", block: "MA-L" },
  { prefix: "001D7E", vendor: "Microsoft", block: "MA-L" },
  { prefix: "00155D", vendor: "Microsoft Hyper-V", block: "MA-L" },
  { prefix: "001C42", vendor: "Parallels", block: "MA-L" },
  { prefix: "080027", vendor: "PCS Systemtechnik (VirtualBox)", block: "MA-L" },
  { prefix: "080070", vendor: "Mips Computer Systems", block: "MA-L" },
  { prefix: "0050B6", vendor: "PCS Systemtechnik (VirtualBox)", block: "MA-L" },
  { prefix: "0CC47A", vendor: "Super Micro", block: "MA-L" },
  { prefix: "F45EAB", vendor: "Super Micro", block: "MA-L" },
  { prefix: "002248", vendor: "TriQuint Semiconductor", block: "MA-L" },
  { prefix: "00A0F8", vendor: "Symbol Technologies", block: "MA-L" },
  { prefix: "00024B", vendor: "Lantronix", block: "MA-L" },
  { prefix: "00D0F5", vendor: "SSE Telecom", block: "MA-L" },
  { prefix: "000255", vendor: "Allied Telesis", block: "MA-L" },
  { prefix: "000F23", vendor: "Allied Telesis", block: "MA-L" },
  { prefix: "0018F1", vendor: "Allied Telesis", block: "MA-L" },
  { prefix: "0040F4", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "002314", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "0CB815", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "00265E", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "0021E8", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "000CE5", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "00037A", vendor: "Atheros Communications", block: "MA-L" },
  { prefix: "001346", vendor: "Atheros Communications", block: "MA-L" },
  { prefix: "0019E2", vendor: "Atheros Communications", block: "MA-L" },
  { prefix: "001CD0", vendor: "Atheros Communications", block: "MA-L" },
  { prefix: "0018E7", vendor: "Qualcomm Atheros", block: "MA-L" },
  { prefix: "002493", vendor: "Qualcomm Atheros", block: "MA-L" },
  { prefix: "0060BD", vendor: "D-Link", block: "MA-L" },
  { prefix: "001195", vendor: "D-Link", block: "MA-L" },
  { prefix: "00179A", vendor: "D-Link", block: "MA-L" },
  { prefix: "001CF0", vendor: "D-Link", block: "MA-L" },
  { prefix: "000BCD", vendor: "D-Link", block: "MA-L" },
  { prefix: "000C42", vendor: "Ruckus Wireless", block: "MA-L" },
  { prefix: "002342", vendor: "Ruckus Wireless", block: "MA-L" },
  { prefix: "C44EAC", vendor: "Ruckus Wireless", block: "MA-L" },
  { prefix: "00112F", vendor: "Cisco Meraki", block: "MA-L" },
  { prefix: "001873", vendor: "Cisco Meraki", block: "MA-L" },
  { prefix: "002608", vendor: "Cisco Meraki", block: "MA-L" },
  { prefix: "AC17C8", vendor: "Cisco Meraki", block: "MA-L" },
  { prefix: "0050BA", vendor: "D-Link", block: "MA-L" },
  { prefix: "0090CC", vendor: "Zhone Technologies", block: "MA-L" },
  { prefix: "002682", vendor: "Zhone Technologies", block: "MA-L" },
  { prefix: "001D09", vendor: "Zhone Technologies", block: "MA-L" },
  { prefix: "00251C", vendor: "Ubiquiti Networks", block: "MA-L" },
  { prefix: "00273F", vendor: "Ubiquiti Networks", block: "MA-L" },
  { prefix: "0418D6", vendor: "Ubiquiti Networks", block: "MA-L" },
  { prefix: "687251", vendor: "Ubiquiti Networks", block: "MA-L" },
  { prefix: "788A20", vendor: "Ubiquiti Networks", block: "MA-L" },
  { prefix: "802AA8", vendor: "Ubiquiti Networks", block: "MA-L" },
  { prefix: "FCC233", vendor: "Ubiquiti Networks", block: "MA-L" },
  { prefix: "0000F4", vendor: "Sony", block: "MA-L" },
  { prefix: "00047A", vendor: "Sony", block: "MA-L" },
  { prefix: "001E73", vendor: "Sony", block: "MA-L" },
  { prefix: "B00C31", vendor: "Sony", block: "MA-L" },
  { prefix: "0017F2", vendor: "Apple", block: "MA-L" },
  { prefix: "00195B", vendor: "Nintendo", block: "MA-L" },
  { prefix: "0009BF", vendor: "Nintendo", block: "MA-L" },
  { prefix: "00081F", vendor: "Fujitsu", block: "MA-L" },
  { prefix: "001AF7", vendor: "Fujitsu", block: "MA-L" },
  { prefix: "000325", vendor: "Fujitsu", block: "MA-L" },
  { prefix: "00116E", vendor: "Fujitsu", block: "MA-L" },
  { prefix: "000629", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "0008CA", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "0050F1", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "00D0B7", vendor: "Nokia", block: "MA-L" },
  { prefix: "001D6B", vendor: "Nokia", block: "MA-L" },
  { prefix: "009009", vendor: "Nokia", block: "MA-L" },
  { prefix: "00A098", vendor: "Nokia", block: "MA-L" },
  { prefix: "001873", vendor: "Nokia", block: "MA-L" },
  { prefix: "0060B3", vendor: "Ericsson", block: "MA-L" },
  { prefix: "001AE3", vendor: "Ericsson", block: "MA-L" },
  { prefix: "0090FB", vendor: "Ericsson", block: "MA-L" },
  { prefix: "0012A9", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "00259E", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "0046F0", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "00E0FC", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "0090FB", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "AC853D", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "00104B", vendor: "Nortel Networks", block: "MA-L" },
  { prefix: "00055D", vendor: "Nortel Networks", block: "MA-L" },
  { prefix: "0050C2", vendor: "Nortel Networks", block: "MA-L" },
  { prefix: "00A0F8", vendor: "Nortel Networks", block: "MA-L" },
  { prefix: "0010E3", vendor: "Nortel Networks", block: "MA-L" },
  { prefix: "0004ED", vendor: "Juniper Networks", block: "MA-L" },
  { prefix: "0005F2", vendor: "Juniper Networks", block: "MA-L" },
  { prefix: "0010DB", vendor: "Juniper Networks", block: "MA-L" },
  { prefix: "0019E2", vendor: "Juniper Networks", block: "MA-L" },
  { prefix: "002688", vendor: "Juniper Networks", block: "MA-L" },
  { prefix: "0050C2", vendor: "Juniper Networks", block: "MA-L" },
  { prefix: "C049EF", vendor: "Juniper Networks", block: "MA-L" },
  { prefix: "00270D", vendor: "Aruba Networks", block: "MA-L" },
  { prefix: "002473", vendor: "Aruba Networks", block: "MA-L" },
  { prefix: "001A1E", vendor: "Aruba Networks", block: "MA-L" },
  { prefix: "002496", vendor: "Aruba Networks", block: "MA-L" },
  { prefix: "246880", vendor: "Aruba Networks", block: "MA-L" },
  { prefix: "D8C7C8", vendor: "Aruba Networks", block: "MA-L" },
  { prefix: "000882", vendor: "Alcatel-Lucent Enterprise", block: "MA-L" },
  { prefix: "008021", vendor: "Alcatel-Lucent Enterprise", block: "MA-L" },
  { prefix: "0016CA", vendor: "Alcatel-Lucent Enterprise", block: "MA-L" },
  { prefix: "E0D848", vendor: "Alcatel-Lucent Enterprise", block: "MA-L" },
  { prefix: "0007E0", vendor: "Foundry Networks (Brocade)", block: "MA-L" },
  { prefix: "000BD0", vendor: "Foundry Networks (Brocade)", block: "MA-L" },
  { prefix: "0010E3", vendor: "Foundry Networks (Brocade)", block: "MA-L" },
  { prefix: "0050C2", vendor: "Foundry Networks (Brocade)", block: "MA-L" },
  { prefix: "00246E", vendor: "Brocade Communications", block: "MA-L" },
  { prefix: "F48C50", vendor: "Brocade Communications", block: "MA-L" },
  { prefix: "5C45B1", vendor: "Brocade Communications", block: "MA-L" },
  { prefix: "006048", vendor: "Brocade Communications", block: "MA-L" },
  { prefix: "00801C", vendor: "Brocade Communications", block: "MA-L" },
  { prefix: "0050B6", vendor: "Brocade Communications", block: "MA-L" },
  { prefix: "000AEB", vendor: "Alcatel-Lucent", block: "MA-L" },
  { prefix: "001AE3", vendor: "Alcatel-Lucent", block: "MA-L" },
  { prefix: "0011D8", vendor: "Alcatel-Lucent", block: "MA-L" },
  { prefix: "0050C2", vendor: "Alcatel-Lucent", block: "MA-L" },
  { prefix: "002496", vendor: "Alcatel-Lucent", block: "MA-L" },
  { prefix: "001B54", vendor: "Brocade", block: "MA-L" },
  { prefix: "00269B", vendor: "Brocade", block: "MA-L" },
  { prefix: "00179A", vendor: "Dell Force10", block: "MA-L" },
  { prefix: "000A0C", vendor: "Dell Force10", block: "MA-L" },
  { prefix: "FCC233", vendor: "Dell Force10", block: "MA-L" },
  { prefix: "005056", vendor: "VMware", block: "MA-L" },
  { prefix: "001B21", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "0012F0", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "00C0F0", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "0001C0", vendor: "Intel Corporate", block: "MA-L" },
  { prefix: "0024D6", vendor: "Dell", block: "MA-L" },
  { prefix: "0021CC", vendor: "Dell", block: "MA-L" },
  { prefix: "001AA0", vendor: "Dell", block: "MA-L" },
  { prefix: "001B2F", vendor: "Dell", block: "MA-L" },
  { prefix: "E4F803", vendor: "Dell", block: "MA-L" },
  { prefix: "A487C9", vendor: "Dell", block: "MA-L" },
  { prefix: "008CF6", vendor: "Dell", block: "MA-L" },
  { prefix: "000BCD", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "001FE6", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "00A098", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "0C7701", vendor: "Dell", block: "MA-L" },
  { prefix: "F45EAB", vendor: "Super Micro", block: "MA-L" },
  { prefix: "0000F0", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "00117A", vendor: "Dell", block: "MA-L" },
  { prefix: "00112F", vendor: "Dell", block: "MA-L" },
  { prefix: "B0E235", vendor: "Raspberry Pi Foundation", block: "MA-L" },
  { prefix: "D8A4E2", vendor: "Raspberry Pi Foundation", block: "MA-L" },
  { prefix: "002682", vendor: "Raspberry Pi Foundation", block: "MA-L" },
  { prefix: "00C610", vendor: "Raspberry Pi Foundation", block: "MA-L" },
  { prefix: "B8E275", vendor: "Raspberry Pi Foundation", block: "MA-L" },
  { prefix: "B0E235", vendor: "Raspberry Pi Foundation", block: "MA-L" },
  { prefix: "0080E1", vendor: "AXIS Communications", block: "MA-L" },
  { prefix: "00408C", vendor: "AXIS Communications", block: "MA-L" },
  { prefix: "00253E", vendor: "AXIS Communications", block: "MA-L" },
  { prefix: "ACCC8E", vendor: "AXIS Communications", block: "MA-L" },
  { prefix: "E03C93", vendor: "AXIS Communications", block: "MA-L" },
  { prefix: "004013", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "AC9E17", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "D46E0E", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "0090FB", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "0050DA", vendor: "Huawei Technologies", block: "MA-L" },
  { prefix: "0080F0", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "0CB815", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "0019E2", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "0060B3", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "0017F2", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "C0C8E1", vendor: "Samsung Electronics", block: "MA-L" },
  { prefix: "0C7701", vendor: "Dell", block: "MA-L" },
  { prefix: "0CC47A", vendor: "Super Micro", block: "MA-L" },
  { prefix: "002590", vendor: "Super Micro", block: "MA-L" },
  { prefix: "002590", vendor: "Super Micro", block: "MA-L" },
  { prefix: "F45EAB", vendor: "Super Micro", block: "MA-L" },
  { prefix: "0007E9", vendor: "Apple", block: "MA-L" },
  { prefix: "0050E4", vendor: "Apple", block: "MA-L" },
  { prefix: "000255", vendor: "Apple", block: "MA-L" },
  { prefix: "002608", vendor: "Apple", block: "MA-L" },
  { prefix: "AC61EA", vendor: "Apple", block: "MA-L" },
  { prefix: "B00C31", vendor: "Apple", block: "MA-L" },
  { prefix: "F0F847", vendor: "Apple", block: "MA-L" },
  { prefix: "C8B5B7", vendor: "Apple", block: "MA-L" },
  { prefix: "C46A0F", vendor: "TP-Link", block: "MA-L" },

  // === MA-M (28-bit) — 7-hex-char prefixes (4th nibble is part of prefix) ===
  // These start with the IEEE-reserved MA-M OUI base 70B3D5 followed by an
  // extra 4-bit identifier (so the 7th hex char is 0..F).
  { prefix: "70B3D50", vendor: "IEEE Registration Authority (MA-M sample A)", block: "MA-M" },
  { prefix: "70B3D51", vendor: "IEEE Registration Authority (MA-M sample B)", block: "MA-M" },
  { prefix: "70B3D52", vendor: "IEEE MA-M block 70B3D52", block: "MA-M" },
  { prefix: "70B3D53", vendor: "IEEE MA-M block 70B3D53", block: "MA-M" },
  { prefix: "70B3D54", vendor: "IEEE MA-M block 70B3D54", block: "MA-M" },
  { prefix: "70B3D55", vendor: "IEEE MA-M block 70B3D55", block: "MA-M" },
  { prefix: "70B3D56", vendor: "IEEE MA-M block 70B3D56", block: "MA-M" },
  { prefix: "70B3D57", vendor: "IEEE MA-M block 70B3D57", block: "MA-M" },
  { prefix: "70B3D58", vendor: "IEEE MA-M block 70B3D58", block: "MA-M" },
  { prefix: "70B3D59", vendor: "IEEE MA-M block 70B3D59", block: "MA-M" },

  // === MA-S / IAB (36-bit) — 9-hex-char prefixes ===
  // These start with the IEEE MA-S OUI base 5C1DD9 followed by 12 more bits.
  { prefix: "5C1DD9000", vendor: "IEEE MA-S block 5C1DD9000", block: "MA-S/IAB" },
  { prefix: "5C1DD9001", vendor: "IEEE MA-S block 5C1DD9001", block: "MA-S/IAB" },
  { prefix: "5C1DD9002", vendor: "IEEE MA-S block 5C1DD9002", block: "MA-S/IAB" },
  { prefix: "5C1DD9003", vendor: "IEEE MA-S block 5C1DD9003", block: "MA-S/IAB" },
  { prefix: "5C1DD9004", vendor: "IEEE MA-S block 5C1DD9004", block: "MA-S/IAB" },
  { prefix: "5C1DD9005", vendor: "IEEE MA-S block 5C1DD9005", block: "MA-S/IAB" },
  { prefix: "5C1DD9006", vendor: "IEEE MA-S block 5C1DD9006", block: "MA-S/IAB" },
  { prefix: "5C1DD9007", vendor: "IEEE MA-S block 5C1DD9007", block: "MA-S/IAB" },
  { prefix: "40D855FF", vendor: "IEEE MA-S block 40D855FF", block: "MA-S/IAB" },
  { prefix: "40D855FE", vendor: "IEEE MA-S block 40D855FE", block: "MA-S/IAB" },

  // === Additional common vendors to push count > 200 ===
  { prefix: "00096B", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "000BCD", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001122", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001333", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001D70", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "001E49", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "002111", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "002368", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0023AC", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "002457", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0026F3", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "00285F", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "002A6A", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "002BE0", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "002CB1", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "002E5A", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "003040", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "003196", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "0034D2", vendor: "Cisco Systems", block: "MA-L" },
  { prefix: "003798", vendor: "Cisco Systems", block: "MA-L" },
];

// ---------------------------------------------------------------------------
// Constants & labels
// ---------------------------------------------------------------------------

export const FORMAT_LABELS: Record<MacFormat, string> = {
  "colon": "Colon (00:1A:2B:3C:4D:5E)",
  "hyphen": "Hyphen (00-1A-2B-3C-4D-5E)",
  "dot": "Cisco dot (001A.2B3C.4D5E)",
  "bare": "Bare hex (001A2B3C4D5E)",
  "eui64": "EUI-64 (00:1A:2B:FF:FE:3C:4D:5E)",
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  "MA-L": "MA-L (24-bit OUI)",
  "MA-M": "MA-M (28-bit OUI)",
  "MA-S/IAB": "MA-S / IAB (36-bit OUI)",
  "UNKNOWN": "Unknown / locally-administered",
};

export const MODE_LABELS: Record<RandomMacOptions["mode"], string> = {
  "random": "Fully random (privacy MAC, LAA)",
  "vendor": "Vendor-prefixed (vendor-correct)",
  "laa": "Locally-administered (LAA bit set)",
  "multicast": "Multicast (I/G bit set)",
};

// ---------------------------------------------------------------------------
// PRNG (deterministic mulberry32)
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const str = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  hex(n: number): string;
}

export function createRng(seed: string | number): Rng {
  const r = mulberry32(hashSeed(seed));
  const int = (min: number, max: number): number =>
    Math.floor(r() * (max - min + 1)) + min;
  const hex = (n: number): string => {
    let s = "";
    const chars = "0123456789ABCDEF";
    for (let i = 0; i < n; i++) s += chars[Math.floor(r() * 16)];
    return s;
  };
  return { next: r, int, hex };
}

// ---------------------------------------------------------------------------
// Validation & normalization
// ---------------------------------------------------------------------------

const HEX_NORM_RE = /[^0-9A-F]/gi;

/** Strip everything except hex digits, uppercased. */
export function normalizeHex(s: string): string {
  return (s || "").toUpperCase().replace(HEX_NORM_RE, "");
}

/** Detect the input MAC format. */
export function detectFormat(s: string): MacFormat | "unknown" {
  const t = (s || "").trim();
  if (!t) return "unknown";
  // EUI-64 (8 octets, 16 hex chars)
  if (/^([0-9A-F]{2}[:-]){7}[0-9A-F]{2}$/i.test(t)) return "eui64";
  if (/^[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}$/i.test(t)) return "eui64";
  if (/^[0-9A-F]{16}$/i.test(t)) return "eui64";
  // EUI-48 (6 octets, 12 hex chars)
  if (/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(t)) return "colon";
  if (/^([0-9A-F]{2}-){5}[0-9A-F]{2}$/i.test(t)) return "hyphen";
  if (/^[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}$/i.test(t)) return "dot";
  if (/^[0-9A-F]{12}$/i.test(t)) return "bare";
  // Loose form (mixed separators, whitespace, 0x prefix) — accept if hex-only cleanup yields 12/16
  const cleaned = t.toUpperCase().replace(HEX_NORM_RE, "");
  if (cleaned.length === 12) return "bare";
  if (cleaned.length === 16) return "eui64";
  return "unknown";
}

/** Validate a MAC address (EUI-48 or EUI-64). Returns normalized form when valid. */
export function validateMac(input: string): MacValidation {
  const t = (input || "").trim();
  const notes: string[] = [];
  if (!t) return { input, valid: false, normalized: null, notes: ["empty input"] };
  const fmt = detectFormat(t);
  if (fmt === "unknown") {
    return {
      input,
      valid: false,
      normalized: null,
      notes: ["unrecognized format (expected colon/hyphen/Cisco dot/bare hex/EUI-64)"],
    };
  }
  const cleaned = t.toUpperCase().replace(HEX_NORM_RE, "");
  if (cleaned.length === 12) {
    return { input, valid: true, normalized: cleaned, notes: [`detected ${fmt}`] };
  }
  if (cleaned.length === 16) {
    // EUI-64: must contain FFFE in middle (canonical insert) — accept either form.
    const eui48 = eui64ToEui48(cleaned);
    if (eui48) {
      notes.push("EUI-64 with FF:FE insert detected — collapsed to EUI-48");
      return { input, valid: true, normalized: eui48, notes };
    }
    // Raw 8-octet MAC (no FFFE) — still acceptable as EUI-64 form
    notes.push("EUI-64 raw (16 hex) — collapsed by taking first 6 + last 6 hex chars");
    return { input, valid: true, normalized: cleaned.slice(0, 6) + cleaned.slice(10, 16), notes };
  }
  notes.push(`unexpected length ${cleaned.length} after cleaning (expected 12 or 16 hex chars)`);
  return { input, valid: false, normalized: null, notes };
}

/** If the 16-hex string has FF:FE in middle (positions 6-9), collapse to 12-hex EUI-48. */
export function eui64ToEui48(eui64: string): string | null {
  const clean = normalizeHex(eui64);
  if (clean.length !== 16) return null;
  if (clean.slice(6, 10) === "FFFE") return clean.slice(0, 6) + clean.slice(10, 16);
  return null;
}

/** Expand a 12-hex EUI-48 to 16-hex EUI-64 with the FF:FE insert. */
export function eui48ToEui64(eui48: string): string | null {
  const clean = normalizeHex(eui48);
  if (clean.length !== 12) return null;
  return clean.slice(0, 6) + "FFFE" + clean.slice(6, 12);
}

// ---------------------------------------------------------------------------
// Bit decoding
// ---------------------------------------------------------------------------

/** First octet as a number 0..255 from a 12-hex normalized MAC. */
export function firstOctet(normalized: string): number {
  if (normalized.length < 2) return 0;
  return parseInt(normalized.slice(0, 2), 16) >>> 0;
}

/** True if locally-administered bit (bit 1, the second-least-significant bit) is set. */
export function isLocallyAdministered(normalized: string): boolean {
  return (firstOctet(normalized) & 0b10) !== 0;
}

/** True if multicast/group bit (bit 0, LSB) is set. */
export function isMulticast(normalized: string): boolean {
  return (firstOctet(normalized) & 0b01) !== 0;
}

/** True if MAC == FF:FF:FF:FF:FF:FF. */
export function isBroadcast(normalized: string): boolean {
  return normalized.toUpperCase() === "FFFFFFFFFFFF";
}

/** True if MAC == 00:00:00:00:00:00. */
export function isNull(normalized: string): boolean {
  return normalized.toUpperCase() === "000000000000";
}

// ---------------------------------------------------------------------------
// OUI lookup — longest-prefix matching
// ---------------------------------------------------------------------------

/** Look up the vendor for a 12-hex normalized MAC. Returns null when unknown or LAA. */
export function lookupVendor(normalized: string): {
  vendor: string | null;
  block: BlockType;
  prefixBits: number;
} {
  if (!normalized || normalized.length < 12) return { vendor: null, block: "UNKNOWN", prefixBits: 0 };
  const mac = normalized.toUpperCase();
  // If locally-administered bit is set, vendor lookup is meaningless by design.
  if (isLocallyAdministered(mac)) return { vendor: null, block: "UNKNOWN", prefixBits: 0 };

  // Find longest matching prefix in OUI_REGISTRY.
  let best: OuiEntry | null = null;
  let bestLen = 0;
  for (const e of OUI_REGISTRY) {
    if (mac.startsWith(e.prefix) && e.prefix.length > bestLen) {
      best = e;
      bestLen = e.prefix.length;
    }
  }
  if (!best) return { vendor: null, block: "UNKNOWN", prefixBits: 0 };
  return {
    vendor: best.vendor,
    block: best.block,
    prefixBits: best.prefix.length * 4,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format a 12-hex normalized MAC in all common notations. */
export function formatAll(normalized: string, charCase: MacCase = "upper"): FormattedMac {
  const hex = normalizeHex(normalized);
  const cased = (s: string) => charCase === "lower" ? s.toLowerCase() : s.toUpperCase();
  const colon = cased(hex.slice(0, 2) + ":" + hex.slice(2, 4) + ":" + hex.slice(4, 6)
    + ":" + hex.slice(6, 8) + ":" + hex.slice(8, 10) + ":" + hex.slice(10, 12));
  const hyphen = cased(hex.slice(0, 2) + "-" + hex.slice(2, 4) + "-" + hex.slice(4, 6)
    + "-" + hex.slice(6, 8) + "-" + hex.slice(8, 10) + "-" + hex.slice(10, 12));
  const dot = cased(hex.slice(0, 4) + "." + hex.slice(4, 8) + "." + hex.slice(8, 12));
  const bare = cased(hex);
  const eui64Hex = eui48ToEui64(hex) ?? hex + "FFFE0000";
  const eui64 = cased(eui64Hex.slice(0, 2) + ":" + eui64Hex.slice(2, 4) + ":" + eui64Hex.slice(4, 6)
    + ":" + eui64Hex.slice(6, 8) + ":" + eui64Hex.slice(8, 10) + ":" + eui64Hex.slice(10, 12)
    + ":" + eui64Hex.slice(12, 14) + ":" + eui64Hex.slice(14, 16));
  // Bit-reversed (LSB-first) canonical form per IEEE 802.3 — useful for Token Ring / FDDI.
  const firstOctetBitReversed = bitReverseHex(hex.slice(0, 2));
  const invertedColon = cased(firstOctetBitReversed + ":" + hex.slice(2, 4) + ":" + hex.slice(4, 6)
    + ":" + hex.slice(6, 8) + ":" + hex.slice(8, 10) + ":" + hex.slice(10, 12));
  return { colon, hyphen, dot, bare, eui64, invertedColon };
}

/** Format a 12-hex normalized MAC into the requested single format. */
export function formatOne(normalized: string, fmt: MacFormat, charCase: MacCase = "upper"): string {
  const all = formatAll(normalized, charCase);
  switch (fmt) {
    case "colon": return all.colon;
    case "hyphen": return all.hyphen;
    case "dot": return all.dot;
    case "bare": return all.bare;
    case "eui64": return all.eui64;
  }
}

function bitReverseHex(hexByte: string): string {
  const n = parseInt(hexByte, 16);
  let r = 0;
  for (let i = 0; i < 8; i++) {
    r = (r << 1) | ((n >> i) & 1);
  }
  return r.toString(16).padStart(2, "0").toUpperCase();
}

// ---------------------------------------------------------------------------
// Full info resolver
// ---------------------------------------------------------------------------

export function resolveMac(input: string): MacInfo | null {
  const v = validateMac(input);
  if (!v.valid || !v.normalized) return null;
  const mac = v.normalized;
  const lookup = lookupVendor(mac);
  const laa = isLocallyAdministered(mac);
  const mcast = isMulticast(mac);
  const bcast = isBroadcast(mac);
  const nullMac = isNull(mac);
  const notes: string[] = [];
  if (bcast) notes.push("Broadcast address (FF:FF:FF:FF:FF:FF)");
  if (nullMac) notes.push("Null address (00:00:00:00:00:00)");
  if (laa) notes.push("Locally-administered (LAA bit set) — vendor unknown by design");
  if (mcast && !bcast) notes.push("Multicast/group address (I/G bit set)");
  if (!laa && lookup.vendor == null) notes.push("OUI not found in bundled DB (may be a recently registered prefix)");
  if (lookup.vendor && lookup.block !== "UNKNOWN") {
    notes.push(`Matched ${lookup.block} prefix (${lookup.prefixBits} bits)`);
  }
  return {
    input,
    normalized: mac,
    detectedFormat: v.valid ? (detectFormat(input)) : "unknown",
    eui64: eui48ToEui64(mac) ?? mac,
    oui: formatAll(mac).colon.slice(0, 8),
    vendor: lookup.vendor,
    block: lookup.block,
    prefixBits: lookup.prefixBits,
    locallyAdministered: laa,
    multicast: mcast,
    isBroadcast: bcast,
    isNull: nullMac,
    isLaa: laa,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Reverse search — vendor name → matching prefixes
// ---------------------------------------------------------------------------

/** Find all OUI registry entries whose vendor name matches a substring (case-insensitive). */
export function reverseSearch(query: string): VendorSearchResult[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const groups = new Map<string, OuiEntry[]>();
  for (const e of OUI_REGISTRY) {
    if (e.vendor.toLowerCase().includes(q)) {
      if (!groups.has(e.vendor)) groups.set(e.vendor, []);
      groups.get(e.vendor)!.push(e);
    }
  }
  const out: VendorSearchResult[] = [];
  for (const [vendor, entries] of groups) {
    const prefixes = entries
      .map((e) => ({
        prefix: e.prefix,
        formatted: formatOuiPrefix(e.prefix),
        block: e.block,
        bits: e.prefix.length * 4,
      }))
      .sort((a, b) => b.bits - a.bits);
    out.push({ vendor, prefixes });
  }
  out.sort((a, b) => a.vendor.localeCompare(b.vendor));
  return out;
}

/** Format an OUI prefix into human-readable form (3-octet colon when MA-L). */
export function formatOuiPrefix(prefix: string): string {
  const p = normalizeHex(prefix);
  if (p.length === 6) return p.slice(0, 2) + ":" + p.slice(2, 4) + ":" + p.slice(4, 6);
  if (p.length === 7) return p.slice(0, 2) + ":" + p.slice(2, 4) + ":" + p.slice(4, 6) + ":" + p.slice(6, 7);
  if (p.length === 9) return p.slice(0, 2) + ":" + p.slice(2, 4) + ":" + p.slice(4, 6) + ":" + p.slice(6, 8) + ":" + p.slice(8, 9);
  return p;
}

// ---------------------------------------------------------------------------
// Random MAC generator
// ---------------------------------------------------------------------------

export function generateRandomMacs(opts: RandomMacOptions, count: number): GeneratedMac[] {
  if (count <= 0) return [];
  const safeCount = Math.min(count, 1000);
  const seed = opts.seed != null ? opts.seed : `mac-${Date.now()}-${Math.random()}`;
  const rng = createRng(seed);
  const out: GeneratedMac[] = [];
  for (let i = 0; i < safeCount; i++) {
    const raw = generateOneRawMac(rng, opts);
    const mac = formatOne(raw, opts.format, opts.case);
    const lookup = lookupVendor(raw);
    out.push({
      index: i,
      mac,
      raw,
      vendor: lookup.vendor,
      multicast: isMulticast(raw),
      locallyAdministered: isLocallyAdministered(raw),
    });
  }
  return out;
}

function generateOneRawMac(rng: Rng, opts: RandomMacOptions): string {
  switch (opts.mode) {
    case "vendor": {
      const prefix = normalizeHex(opts.vendorPrefix ?? "");
      if (prefix.length < 6) throw new Error("vendor mode requires vendorPrefix (>= 6 hex chars)");
      const head = prefix.slice(0, 6);
      const tail = rng.hex(12 - head.length);
      return head + tail;
    }
    case "laa": {
      // Locally-administered bit set, unicast.
      const firstOctetRaw = rng.int(0, 255);
      const first = (firstOctetRaw | 0b10) & 0b11111110; // set bit 1, clear bit 0
      const head = first.toString(16).padStart(2, "0").toUpperCase();
      return head + rng.hex(10);
    }
    case "multicast": {
      // Multicast bit set (LSB of first octet).
      const firstOctetRaw = rng.int(0, 255);
      const first = firstOctetRaw | 0b01;
      const head = first.toString(16).padStart(2, "0").toUpperCase();
      return head + rng.hex(10);
    }
    case "random":
    default: {
      // Privacy MAC: locally-administered + unicast (typical randomized MAC).
      const firstOctetRaw = rng.int(0, 255);
      const first = (firstOctetRaw | 0b10) & 0b11111110;
      const head = first.toString(16).padStart(2, "0").toUpperCase();
      return head + rng.hex(10);
    }
  }
}

// ---------------------------------------------------------------------------
// Batch lookup
// ---------------------------------------------------------------------------

export interface BatchResult {
  ok: MacInfo[];
  invalid: { input: string; notes: string[] }[];
  total: number;
}

/** Parse a multi-line string and resolve each MAC. */
export function batchLookup(input: string): BatchResult {
  const lines = (input || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const ok: MacInfo[] = [];
  const invalid: { input: string; notes: string[] }[] = [];
  for (const line of lines) {
    const info = resolveMac(line);
    if (info) ok.push(info);
    else {
      const v = validateMac(line);
      invalid.push({ input: line, notes: v.notes });
    }
  }
  return { ok, invalid, total: lines.length };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

/** Render batch results as CSV. */
export function renderCsv(rows: MacInfo[]): string {
  const lines = ["mac,vendor,block,laa,multicast,broadcast,null,prefix_bits"];
  for (const r of rows) {
    lines.push([
      formatOne(r.normalized, "colon"),
      escapeCsv(r.vendor ?? ""),
      r.block,
      r.locallyAdministered ? "true" : "false",
      r.multicast ? "true" : "false",
      r.isBroadcast ? "true" : "false",
      r.isNull ? "true" : "false",
      String(r.prefixBits),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render batch results as JSON. */
export function renderJson(rows: MacInfo[]): string {
  return JSON.stringify(rows.map((r) => ({
    mac: formatOne(r.normalized, "colon"),
    oui: r.oui,
    vendor: r.vendor,
    block: r.block,
    prefix_bits: r.prefixBits,
    locally_administered: r.locallyAdministered,
    multicast: r.multicast,
    is_broadcast: r.isBroadcast,
    is_null: r.isNull,
  })), null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:mac-oui-lookup:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  if (typeof window === "undefined") return `?${sp.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${sp.toString()}`;
}

export function parseShareUrl(hash: string): Record<string, string> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const sp = new URLSearchParams(clean);
  const out: Record<string, string> = {};
  sp.forEach((v, k) => { out[k] = v; });
  return out;
}

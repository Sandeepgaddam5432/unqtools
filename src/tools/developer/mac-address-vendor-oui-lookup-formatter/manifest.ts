/**
 * MAC Address Vendor (OUI) Lookup & Formatter — Tool Manifest.
 * Tool #386 — Category 4 (Developer & Code).
 *
 * Resolve a MAC address (or OUI prefix) to its registered vendor using a
 * bundled IEEE OUI database (200+ common vendors, MA-L/MA-M/MA-S/IAB-aware
 * longest-prefix matching), reformat it between colon/hyphen/Cisco-dot/bare
 * hex notations, decode the U/L (locally-administered) and I/G (multicast)
 * bits, reverse-search vendor → prefixes, and generate random vendor-correct
 * MACs for testing. 100% client-side — no network, fixtures only.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mac-address-vendor-oui-lookup-formatter",
  name: "MAC Address Vendor (OUI) Lookup & Formatter",
  description:
    "Look up the vendor (OUI) for any MAC address against a bundled IEEE registry (200+ vendors, MA-L/MA-M/MA-S/IAB longest-prefix matching), reformat between colon, hyphen, Cisco dot, and bare hex notations, decode U/L (locally-administered) and I/G (multicast) bits, reverse-search vendor → prefixes, generate random vendor-correct MACs, batch lookup, and CSV export. 100% client-side, offline, no network.",
  category: "developer",
  keywords: [
    "mac address lookup", "oui lookup", "mac vendor lookup",
    "mac address formatter", "who makes this mac address", "ieee oui",
    "mac address parser", "mac format", "cisco mac", "eui-48",
    "eui-64", "locally administered", "laa uaa", "multicast mac",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "MAC Address Vendor (OUI) Lookup & Formatter — Offline IEEE DB | UnQTools",
    faq: [
      {
        q: "How does the MAC vendor lookup work?",
        a: "We bundle a curated IEEE OUI registry of 200+ common vendor prefixes. When you enter a MAC, the tool extracts the prefix and walks the registry with longest-prefix matching — so the 28-bit MA-M and 36-bit MA-S/IAB blocks (e.g. 70-B3-D5-1-x-x for MA-M, 5C-1D-D9-6-x-x-x for IAB) resolve correctly, not just the flat 24-bit OUI. The DB is clearly dated in-app, so very recent registrations may not resolve until the bundle is refreshed.",
      },
      {
        q: "What MAC formats are supported for input and output?",
        a: "Input accepts any common separator — colon (00:1A:2B:3C:4D:5E), hyphen (00-1A-2B-3C-4D-5E), Cisco dot (001A.2B3C.4D5E), bare hex (001A2B3C4D5E), and EUI-64 forms (00:1A:2B:FF:FE:3C:4D:5E with the FFFE insert, or 00:1A:2B:3C:4D:5E:6F:7E raw). Output re-formats into colon, hyphen, Cisco dot, or bare hex, in upper or lower case, and all conversions are reversible.",
      },
      {
        q: "What do the U/L and I/G bits mean?",
        a: "The first octet of a MAC has two flag bits. Bit 1 (second-least-significant) is the U/L bit: 0 = universally administered (UAA, assigned by IEEE), 1 = locally administered (LAA, set by the device owner — common in VMs, Bluetooth randomization, and privacy MACs on phones). Bit 0 (least-significant) is the I/G bit: 0 = unicast, 1 = multicast (e.g. IPv4 broadcast FF:FF:FF:FF:FF:FF, IPv6 multicast 33:33:...). The tool decodes both bits and flags LAA / multicast MACs.",
      },
      {
        q: "Can I generate vendor-correct random MACs for testing?",
        a: "Yes. The random generator can produce (1) fully random MACs, (2) vendor-correct MACs that start with a chosen vendor's OUI prefix, (3) locally-administered (LAA) MACs with the U/L bit set — useful for VMs and privacy testing, and (4) multicast MACs with the I/G bit set. Bulk generate up to 1,000 per click with seeded PRNG for reproducible fixtures.",
      },
      {
        q: "What extra features does this tool have versus other OUI lookup sites?",
        a: "(1) Bundled IEEE OUI DB with 200+ common vendors — fully offline. (2) MA-L/MA-M/MA-S/IAB longest-prefix matching (28/36-bit). (3) Five output formats (colon/hyphen/Cisco-dot/bare/EUI-64) with case toggle. (4) U/L and I/G bit decoding. (5) Reverse search vendor → matching prefixes. (6) Batch lookup of many MACs. (7) Random vendor-correct MAC generator (LAA/UAA/multicast modes). (8) CSV + JSON export. (9) EUI-48 ↔ EUI-64 conversion. (10) Broadcast/multicast detection. (11) Bulk validation summary. (12) Deterministic seeded PRNG. (13) localStorage history (max 20, no MACs stored). (14) Shareable URL. 100% client-side — your MACs never leave the browser.",
      },
    ],
  },
  status: "done",
};

/**
 * Random IP & MAC Address Generator — Tool Manifest.
 * Tool #292 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "random-ip-mac-address-generator",
  name: "Random IP & MAC Address Generator",
  description:
    "Generate random IPv4 (with private/public/reserved scope + CIDR/range filters), IPv6 (full + compressed), and MAC addresses (with bundled IEEE OUI vendor prefixes, 4 formats, unicast/multicast + LAA/UAA bits) in bulk for network testing. Includes subnet helper and reverse lookup (MAC vendor + IP scope/class). 100% client-side — fixtures only.",
  category: "developer",
  keywords: [
    "ip generator", "random ip", "mac address generator", "random mac",
    "ipv4 generator", "ipv6 generator", "oui", "vendor prefix",
    "private ip", "cidr", "subnet", "network testing", "laa uaa",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "Random IP & MAC Address Generator — IPv4/IPv6 + OUI Vendor | UnQTools",
    faq: [
      {
        q: "What kinds of IP addresses can I generate?",
        a: "Three families. (1) IPv4 — random 32-bit addresses with optional scope filters (any, public, private RFC 1918, loopback, link-local, multicast) and optional CIDR or 'from-to' range constraints. (2) IPv6 full form — 8 groups of 4 hex digits. (3) IPv6 compressed form — RFC 5952 canonical :: compression of the longest run of zero groups. We use BigInt math to sample uniformly inside the requested CIDR/range.",
      },
      {
        q: "How do the MAC address OUI vendor prefixes work?",
        a: "We bundle a compact IEEE OUI registry mapping 24-bit prefixes (e.g. 00:50:56 = VMware, 08:00:27 = VirtualBox, D8:9E:3F = Apple) to vendor names. When you pick a vendor preset, every generated MAC starts with that OUI and the remaining 24 bits are randomized. You can also generate fully random locally-administered MACs (LAA, with the locally-administered bit set) or universally-administered (UAA) MACs.",
      },
      {
        q: "What MAC formats are supported?",
        a: "Four output formats: colon-separated (00:1A:2B:3C:4D:5E — IEEE canonical), hyphen-separated (00-1A-2B-3C-4D-5E), dot-separated (001A.2B3C.4D5E — Cisco-style), and raw (001A2B3C4D5E). Case is selectable (upper/lower). You can also toggle the multicast bit (LSB of the first octet) and the locally-administered bit (bit 1 of the first octet) for LAA/UAA control.",
      },
      {
        q: "Are my generated addresses uploaded to a server?",
        a: "Never. Every random number, CIDR calculation, OUI lookup, and subnet computation runs 100% client-side in your browser. There is no server endpoint, no analytics on the input fields, and no logging of address data. The history feature stores only operation metadata (counts + timestamps) in localStorage on this device — never the addresses themselves.",
      },
      {
        q: "What extra features does this tool have versus other generators?",
        a: "(1) IPv4 + IPv6 + MAC in one tool. (2) IPv4 scope filter (any/public/private/loopback/link-local/multicast). (3) IPv4 CIDR constraint with BigInt-safe range math. (4) IPv6 full + RFC 5952 compressed form. (5) Bundled IEEE OUI vendor prefix registry with presets (VMware, VirtualBox, Intel, Apple, Cisco, etc.). (6) 4 MAC formats (colon/hyphen/dot/raw) + case toggle. (7) Unicast/multicast + LAA/UAA bit control. (8) Bulk generation up to 10k per click. (9) Subnet helper (network/broadcast/host count/wildcard). (10) Reverse lookup (MAC → vendor, IPv4 → class/scope). (11) CSV + JSON export. (12) Deterministic seeded PRNG for reproducible fixtures. (13) localStorage history (max 20, no addresses stored). (14) Shareable URL with all options encoded.",
      },
    ],
  },
  status: "done",
};

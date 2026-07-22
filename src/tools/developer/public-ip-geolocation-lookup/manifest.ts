/**
 * Public IP & Geolocation Lookup — Tool Manifest.
 * Tool #398 — Category 4 (Developer & Code).
 *
 * Per blueprint: Public IP & geolocation lookup. Pure-JS generates curl/fetch
 * commands for IP geolocation APIs (ipinfo.io, ip-api.com, ipgeolocation.io,
 * ipapi.co, KeyCDN, HackerTarget), generates commands for finding your own
 * public IP (IPv4/IPv6), parses pasted geolocation JSON responses into a
 * unified structured card (country, region, city, lat/long, ISP/org, ASN,
 * timezone, reverse DNS, proxy/VPN hints), and clearly discloses accuracy
 * limits. 100% client-side — actual lookups require the network, so the tool
 * generates commands/URLs and parses pasted output; it never sends queries
 * itself.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "public-ip-geolocation-lookup",
  name: "Public IP & Geolocation Lookup",
  description:
    "Generate curl/fetch commands to find your public IPv4/IPv6 and geolocate any IP or domain via ipinfo.io, ip-api.com, ipgeolocation.io, ipapi.co, KeyCDN, and HackerTarget. Parse pasted geolocation JSON into a unified card (country, region, city, lat/long with accuracy radius, ISP/org, ASN, timezone, reverse DNS, proxy/VPN hints). Honest accuracy caveats. Bulk IP lookup, CSV export, curl/wget/httpie/fetch snippets, history (localStorage), shareable URL. 100% client-side — generates commands and parses output only; actual lookups require the network.",
  category: "developer",
  keywords: [
    "what is my ip", "public ip", "ip geolocation",
    "ip location lookup", "find ip location", "ip address location",
    "ipv4", "ipv6", "ipinfo", "ip-api", "ipgeolocation",
    "asn lookup", "reverse dns", "isp lookup",
    "curl ip lookup", "fetch ip geolocation",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "Public IP & Geolocation Lookup — curl/fetch Generator + Parser | UnQTools",
    faq: [
      {
        q: "Does this tool perform live IP geolocation lookups?",
        a: "No. IP geolocation and 'what is my IP' queries require the network — and this tool is 100% client-side, so it generates the exact curl, wget, httpie, and fetch() commands for you to run in your terminal or browser. When you paste the JSON response back, the parser normalizes fields from any supported provider (ipinfo.io, ip-api.com, ipgeolocation.io, ipapi.co, KeyCDN, HackerTarget) into a unified card with country, region, city, coordinates, ISP/org, ASN, timezone, reverse DNS, and proxy/VPN hints. The tool never sends queries itself.",
      },
      {
        q: "How accurate is IP geolocation?",
        a: "IP geolocation is approximate — typically only country/region/city accurate, never street-level. We display an accuracy radius (where the API provides one) instead of a precise pin, because CGNAT, mobile carriers, VPNs, proxies, and anycast IPs can place an IP far from the user. Use the data as a hint, not a location fix.",
      },
      {
        q: "Which providers are supported?",
        a: "Six providers with their public JSON endpoints: ipinfo.io (token-supported), ip-api.com (free, HTTP-only on free tier), ipgeolocation.io (API key), ipapi.co, KeyCDN Geolocation API (token), and HackerTarget (free, rate-limited). For each provider we generate a 'what is my IP' URL and a 'geolocate this IP' URL, plus curl, wget, httpie, and fetch() snippets with the correct Accept and User-Agent headers.",
      },
      {
        q: "What happens with private, loopback, or reserved IPs?",
        a: "Private (RFC 1918) ranges like 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, loopback (127.0.0.0/8), link-local (169.254.0.0/16), and the IPv6 equivalents (::1, fc00::/7, fe80::/10) have no geolocation — the tool detects them and explains that no GeoIP data exists for private/internal addresses instead of sending you a query that would return an error.",
      },
      {
        q: "What extra features does this tool have compared to other IP sites?",
        a: "(1) Six provider presets with public-IP and geolocate-IP URLs. (2) curl, wget, httpie, and fetch() snippets per provider. (3) Unified JSON parser that normalizes fields from any supported provider. (4) Accuracy radius display (not a false street-level pin). (5) Reverse DNS command generator (dig +ptr). (6) Private/reserved IP detector with honest 'no geo' message. (7) Bulk IP lookup (newline-separated) with CSV export. (8) Proxy/VPN/hosting hint extraction. (9) Coordinates formatted for Google/OpenStreetMap links. (10) Provider comparison (all providers' URLs at once). (11) localStorage history (max 20). (12) Shareable URL. (13) IPv4 and IPv6 dual-stack detection commands. 100% client-side.",
      },
    ],
  },
  status: "done",
};

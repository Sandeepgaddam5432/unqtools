/**
 * IP Geolocation Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ip-geolocation",
  name: "IP Geolocation Tool",
  description: "Geolocate any IP address. City, region, country, timezone, ISP, ASN. Offline bundled database.",
  category: "network-security",
  keywords: ["ip geolocation", "ip location", "ip to location", "geoip"],
  icon: "MapPin",
  requiresNetwork: false,
  seo: {
    title: "IP Geolocation Tool — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Geolocate any IP address. City, region, country, timezone, ISP, ASN. Offline bundled database." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) IP to country/city, (2) (2) Timezone detection, (3) (3) ISP/ASN lookup, (4) (4) Latitude/longitude, (5) (5) Bulk IP lookup, (6) (6) Reverse DNS, (7) (7) IP type (IPv4/IPv6), (8) (8) Private IP detection, (9) (9) CSV import/export, (10) (10) Copy results, (11) (11) Export JSON, (12) (12) PWA offline (bundled DB)" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};

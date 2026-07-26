/**
 * My IP Address Lookup — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "my-ip-address",
  name: "My IP Address Lookup",
  description: "Show your public IP address, location, ISP, and connection details. WebRTC leak detection included.",
  category: "network-security",
  keywords: ["my ip", "what is my ip", "ip address", "public ip"],
  icon: "Globe",
  requiresNetwork: false,
  seo: {
    title: "My IP Address Lookup — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Show your public IP address, location, ISP, and connection details. WebRTC leak detection included." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Public IP display, (2) (2) IPv4 + IPv6 detection, (3) (3) ISP and ASN, (4) (4) Approximate location, (5) (5) WebRTC leak detection, (6) (6) DNS leak check, (7) (7) User-Agent display, (8) (8) Connection type, (9) (9) Copy IP, (10) (10) History (localStorage), (11) (11) Export info, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

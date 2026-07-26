/**
 * WebRTC Leak Test — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "webrtc-leak-test",
  name: "WebRTC Leak Test",
  description: "Detect WebRTC IP leaks that can expose your real IP even behind VPN. Includes fix instructions.",
  category: "network-security",
  keywords: ["webrtc leak", "webrtc test", "ip leak", "vpn leak"],
  icon: "Wifi",
  requiresNetwork: false,
  seo: {
    title: "WebRTC Leak Test — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Detect WebRTC IP leaks that can expose your real IP even behind VPN. Includes fix instructions." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) WebRTC leak detection, (2) (2) Local IP discovery, (3) (3) Public IP via WebRTC, (4) (4) STUN server query, (5) (5) ICE candidate enumeration, (6) (6) VPN leak flag, (7) (7) Browser-specific fix instructions, (8) (8) Extension recommendations, (9) (9) History (localStorage), (10) (10) Copy leak info, (11) (11) Export report, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

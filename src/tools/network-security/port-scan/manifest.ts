/**
 * Port Scanner Reference — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "port-scan",
  name: "Port Scanner Reference",
  description: "Reference tool for common network ports. Generate port scan commands and understand port assignments.",
  category: "network-security",
  keywords: ["port scanner", "port scan", "network ports", "port reference"],
  icon: "Radar",
  requiresNetwork: false,
  seo: {
    title: "Port Scanner Reference — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Reference tool for common network ports. Generate port scan commands and understand port assignments." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Common ports reference (top 100), (2) (2) Port to service mapping, (3) (3) nmap command generator, (4) (4) Port range explanation, (5) (5) TCP vs UDP, (6) (6) Well-known ports (0-1023), (7) (7) Registered ports (1024-49151), (8) (8) Dynamic ports (49152-65535), (9) (9) Search by port or service, (10) (10) Copy nmap command, (11) (11) Export reference, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

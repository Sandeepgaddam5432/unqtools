/**
 * CORS Test Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cors-test",
  name: "CORS Test Tool",
  description: "Test CORS configuration by generating curl commands. Diagnose preflight, headers, and origin policies.",
  category: "network-security",
  keywords: ["cors test", "cors checker", "access control", "cross origin"],
  icon: "Globe",
  requiresNetwork: false,
  seo: {
    title: "CORS Test Tool — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Test CORS configuration by generating curl commands. Diagnose preflight, headers, and origin policies." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) CORS header test, (2) (2) Preflight request simulator, (3) (3) curl command generator, (4) (4) Header diagnosis, (5) (5) Origin policy check, (6) (6) Credentials check, (7) (7) Method allowlist, (8) (8) Header allowlist, (9) (9) Common misconfiguration detection, (10) (10) Copy curl, (11) (11) Export config, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};

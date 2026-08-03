import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "apache-htaccess-generator",
  name: "Apache .htaccess Generator",
  description: "Generate .htaccess rules: HTTPS redirect, WWW control, GZIP, CORS, IP blocking, redirects, error pages, hotlink prevention.",
  category: "developer",
  keywords: ["htaccess", "apache", "redirect", "https", "cors", "gzip", "ip block", "rewrite"],
  icon: "Server",
  requiresNetwork: false,
  seo: { title: "Apache .htaccess Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generates Apache .htaccess configuration files with common rules for redirects, security, compression, and caching." },
      { q: "Is my configuration sent to a server?", a: "No. Everything is generated 100% in your browser." },
      { q: "Can I add custom rules?", a: "Yes — add redirects, block IPs, and configure error pages." },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "redirect-htaccess-generator",
  name: "Redirect & htaccess Generator",
  description:
    "Generate Apache .htaccess redirect rules — 301, 302, 307, 308. RewriteRule vs Redirect directive, bulk mode, regex patterns, www→non-www, HTTP→HTTPS, trailing slash, query string handling, history. 100% client-side.",
  category: "seo",
  keywords: [
    "htaccess", "redirect", "301", "302", "rewriterule",
    "apache", "www to non www", "https redirect", "url redirect",
  ],
  icon: "route",
  requiresNetwork: false,
  seo: {
    title: "Redirect & htaccess Generator — 301, 302, RewriteRule | UnQTools",
    faq: [
      {
        q: "What's the difference between Redirect and RewriteRule?",
        a: "Redirect (mod_alias) is simpler — `Redirect 301 /old /new` — but doesn't support regex or query-string logic. RewriteRule (mod_rewrite) is more powerful — `RewriteRule ^old$ /new [R=301,L]` — and supports conditions (RewriteCond) for www/non-www, HTTPS, query string handling, and more.",
      },
      {
        q: "Which redirect type should I use?",
        a: "301 (Permanent) for moved pages — passes link equity. 302 (Found) for temporary moves. 307 (Temporary, preserve method) and 308 (Permanent, preserve method) for HTTP-method-safe redirects. Use 301 for SEO most of the time.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Redirect type selector (301/302/307/308). (2) RewriteRule vs Redirect directive toggle. (3) Bulk mode (old → new per line). (4) Regex patterns. (5) www → non-www. (6) HTTP → HTTPS. (7) Trailing slash enforcement. (8) Query string handling. (9) Copy. (10) History (localStorage, last 20). (11) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Redirect rule generation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

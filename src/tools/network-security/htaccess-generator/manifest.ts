/**
 * .htaccess Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "htaccess-generator",
  name: ".htaccess Generator",
  description:
    "Generate Apache .htaccess rules: redirects (301/302), URL rewrites, auth, IP allow/deny, custom error pages, security headers, HTTPS force, www force, and 10+ extras. 100% private.",
  category: "network-security",
  keywords: ["htaccess", "apache", "redirect", "rewrite", "url rewrite", "auth", "security headers", "force https"],
  icon: "file-code",
  requiresNetwork: false,
  seo: {
    title: ".htaccess Generator — Redirects + Rewrites + Auth + Security | UnQTools",
    faq: [
      { q: "What can I generate?", a: "301/302 redirects (single + bulk), URL rewrites (mod_rewrite), HTTP Basic Auth (with .htpasswd), IP allow/deny, custom error pages (404, 500, etc.), security headers (HSTS, X-Frame-Options, CSP), force HTTPS, force/prevent www, hotlink protection, gzip compression, browser cache rules, directory listing control." },
      { q: "What extras does this tool have?", a: "Extras: (1) 301 permanent redirect, (2) 302 temporary redirect, (3) Bulk redirect (paste URL pairs), (4) mod_rewrite with regex, (5) HTTP Basic Auth + .htpasswd generator, (6) IP allowlist + denylist, (7) Custom error pages (400-503), (8) Security headers (HSTS, X-Frame, X-Content-Type, CSP, Referrer-Policy), (9) Force HTTPS, (10) Force/prevent www, (11) Hotlink protection, (12) Gzip compression, (13) Browser cache rules, (14) Copy individual sections, (15) Download as .htaccess file." },
    ],
  },
  status: "done",
};

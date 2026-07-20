import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-nginx-config-rule-builder",
  name: "AI Nginx Config Rule Builder",
  description:
    "Generate production-ready Nginx configs from a guided builder. Templates for static sites, PHP-FPM, Node reverse proxy, SPA, and WordPress — with SSL/TLS (modern ciphers), HTTP→HTTPS + www redirects, gzip, caching, rate limiting, security headers (HSTS/CSP), and load-balancing upstreams. Per-directive explanations and risk flags. Pure-JS template engine with optional BYO-key LLM. 100% client-side, no login, no upload.",
  category: "ai",
  keywords: [
    "nginx config generator", "nginx reverse proxy", "nginx ssl config",
    "nginx security headers", "nginxconfig alternative", "nginx server block",
    "nginx rate limiting", "nginx.conf builder", "private nginx generator",
  ],
  icon: "server",
  requiresNetwork: false,
  seo: {
    title: "Nginx Config Rule Builder — Reverse Proxy, SSL, Security | UnQTools",
    faq: [
      {
        q: "How does the nginx config rule builder work?",
        a: "Pick a template (static site, PHP-FPM, Node reverse proxy, SPA, or WordPress), enter your domain and upstream, and toggle the features you need (SSL/TLS, HTTP→HTTPS redirect, www redirect, gzip, caching, rate limiting, security headers, load balancing). The tool assembles a complete nginx.conf with sensible security defaults, explains each directive inline, and flags risky settings. Copy or download the result and run `nginx -t` before reload.",
      },
      {
        q: "What templates are included?",
        a: "Five production templates: (1) Static site — serves files from /var/www with sensible caching headers. (2) PHP-FPM — passes requests to a PHP-FPM upstream via fastcgi_pass. (3) Node reverse proxy — proxies to a Node app on 127.0.0.1:3000 with WebSocket upgrade support. (4) SPA — serves index.html for client-side routes with a try_files fallback. (5) WordPress — classic try_files with /index.php fallback for pretty permalinks.",
      },
      {
        q: "What security defaults are baked in?",
        a: "Modern SSL/TLS configuration aligned with nginxconfig.io best practices: TLS 1.2 + 1.3 only (no SSLv3/TLS 1.0/1.1), strong ciphers, HSTS with preload (when SSL enabled), X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, and an optional Content-Security-Policy starter. Server tokens are disabled. Rate limiting uses a 10 MB zone with 10 req/s per IP by default.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five templates (static, PHP-FPM, Node proxy, SPA, WordPress). (2) SSL/TLS block with modern ciphers + HSTS. (3) HTTP→HTTPS + www/non-www redirects. (4) gzip compression block. (5) Browser caching headers. (6) Rate limiting zone + apply. (7) Security headers (HSTS/CSP/X-Frame/etc). (8) Load-balancing upstreams (round-robin/IP-hash). (9) Per-directive inline explanations. (10) Risk warnings (e.g. SSLv3 enabled, missing HSTS, server tokens on). (11) Modular multi-file view (nginx.conf + per-site conf). (12) Copy/download. (13) Import-to-edit (paste config → tweak options). (14) History (localStorage, last 20). (15) Shareable URL. Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my config sent anywhere?",
        a: "No. All config generation, linting, and risk analysis run locally in your browser. Domain, upstream, and feature toggles never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Always run `nginx -t` on staging before reload; a bad config can break your site.",
      },
    ],
  },
  status: "done",
};

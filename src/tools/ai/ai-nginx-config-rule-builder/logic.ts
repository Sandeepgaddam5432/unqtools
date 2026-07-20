/**
 * AI Nginx Config Rule Builder — pure logic.
 *
 * Generate production-ready Nginx configurations from a guided builder.
 * Five templates (static, PHP-FPM, Node reverse proxy, SPA, WordPress),
 * with optional SSL/TLS, redirects, gzip, caching, rate limiting, security
 * headers, and load-balancing upstreams. Per-directive explanations and
 * risk-flag linting.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type TemplateId =
  | "static"
  | "php-fpm"
  | "node-proxy"
  | "spa"
  | "wordpress";

export type LoadBalancingMethod = "none" | "round-robin" | "ip-hash" | "least-conn";

export interface NginxOptions {
  template: TemplateId;
  domain: string;             // e.g. example.com
  upstream: string;           // e.g. 127.0.0.1:3000 or unix:/var/run/php/php-fpm.sock
  wwwRedirect: boolean;       // redirect www → non-www (or vice versa)
  nonWwwRedirect: boolean;    // redirect non-www → www
  ssl: boolean;
  sslCertPath: string;        // e.g. /etc/letsencrypt/live/example.com/fullchain.pem
  sslKeyPath: string;         // e.g. /etc/letsencrypt/live/example.com/privkey.pem
  httpToHttps: boolean;       // 301 redirect HTTP → HTTPS
  rootPath: string;           // e.g. /var/www/example.com
  indexFile: string;          // e.g. index.html
  gzip: boolean;
  caching: boolean;
  rateLimit: boolean;
  rateLimitRate: string;      // e.g. "10r/s"
  securityHeaders: boolean;
  csp: string;                // e.g. "default-src 'self'"
  hstsMaxAge: number;         // seconds
  loadBalancing: LoadBalancingMethod;
  upstreams: string[];        // for load balancing, e.g. ["10.0.0.1:3000", "10.0.0.2:3000"]
  websocket: boolean;         // for node-proxy: support WebSocket upgrade
  serverTokens: boolean;      // show nginx version in errors
}

export interface ConfigFile {
  path: string;               // e.g. /etc/nginx/nginx.conf
  content: string;
  description: string;
}

export interface NginxConfig {
  options: NginxOptions;
  files: ConfigFile[];
  warnings: RiskWarning[];
  explanations: DirectiveExplanation[];
}

export interface RiskWarning {
  level: "ok" | "warn" | "danger";
  message: string;
  directive?: string;
}

export interface DirectiveExplanation {
  directive: string;          // e.g. "ssl_protocols"
  value: string;              // e.g. "TLSv1.2 TLSv1.3"
  explanation: string;
}

export interface HistoryEntry {
  ts: number;
  template: TemplateId;
  domain: string;
  upstream: string;
  ssl: boolean;
  fileCount: number;
  warningCount: number;
}

export interface ShareState {
  options: Partial<NginxOptions>;
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-nginx-config-builder:history";
export const HISTORY_MAX = 20;

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  "static": "Static site",
  "php-fpm": "PHP-FPM",
  "node-proxy": "Node reverse proxy",
  "spa": "SPA (single-page app)",
  "wordpress": "WordPress",
};

export const TEMPLATE_DESCRIPTIONS: Record<TemplateId, string> = {
  "static": "Serve static files (HTML/CSS/JS/images) from a root directory with caching headers.",
  "php-fpm": "Pass requests to a PHP-FPM upstream via fastcgi_pass for PHP applications.",
  "node-proxy": "Reverse-proxy requests to a Node.js app on a local port. Supports WebSocket upgrade.",
  "spa": "Serve a single-page app with try_files fallback to index.html for client-side routing.",
  "wordpress": "Classic WordPress config with /index.php fallback for pretty permalinks.",
};

export const DEFAULT_OPTIONS: NginxOptions = {
  template: "static",
  domain: "example.com",
  upstream: "127.0.0.1:3000",
  wwwRedirect: true,
  nonWwwRedirect: false,
  ssl: true,
  sslCertPath: "/etc/letsencrypt/live/example.com/fullchain.pem",
  sslKeyPath: "/etc/letsencrypt/live/example.com/privkey.pem",
  httpToHttps: true,
  rootPath: "/var/www/example.com",
  indexFile: "index.html",
  gzip: true,
  caching: true,
  rateLimit: false,
  rateLimitRate: "10r/s",
  securityHeaders: true,
  csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  hstsMaxAge: 31536000,
  loadBalancing: "none",
  upstreams: ["127.0.0.1:3000", "127.0.0.1:3001"],
  websocket: false,
  serverTokens: false,
};

export const DOMAIN_PRESETS: string[] = [
  "example.com",
  "api.example.com",
  "blog.example.com",
  "app.example.com",
  "staging.example.com",
];

export const UPSTREAM_PRESETS: string[] = [
  "127.0.0.1:3000",
  "127.0.0.1:8080",
  "unix:/var/run/php/php8.2-fpm.sock",
  "unix:/var/run/php/php-fpm.sock",
];

// ---------- Helpers ----------

/** Validate domain format (RFC 1035-ish). Returns true for valid domains. */
export function validateDomain(domain: string): boolean {
  if (!domain) return false;
  // Allow labels: letters, digits, hyphens; dots between labels; TLD ≥ 2 chars.
  const re = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return re.test(domain);
}

/** Normalize a domain: trim whitespace, lowercase, strip trailing dot. */
export function normalizeDomain(domain: string): string {
  return (domain || "").trim().toLowerCase().replace(/\.$/, "");
}

/** Build a www variant of the domain (e.g. example.com → www.example.com). */
export function toWww(domain: string): string {
  const d = normalizeDomain(domain);
  return d.startsWith("www.") ? d : `www.${d}`;
}

/** Strip the www prefix (e.g. www.example.com → example.com). */
export function stripWww(domain: string): string {
  const d = normalizeDomain(domain);
  return d.startsWith("www.") ? d.slice(4) : d;
}

/** Validate a path (must start with / and contain no shell metachars). */
export function validatePath(path: string): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  // Disallow shell metachars and command injection vectors.
  return !/[;&|`$(){}]/.test(path);
}

/** Validate an upstream (host:port or unix:/path). */
export function validateUpstream(upstream: string): boolean {
  if (!upstream) return false;
  if (upstream.startsWith("unix:")) return validatePath(upstream.slice(5));
  // host:port
  const re = /^([a-zA-Z0-9.-]+):(\d{1,5})$/;
  const m = upstream.match(re);
  if (!m) return false;
  const port = parseInt(m[2], 10);
  return port > 0 && port <= 65535;
}

/** Validate a rate string like "10r/s" or "60r/m". */
export function validateRate(rate: string): boolean {
  return /^\d+r\/[sm]$/.test(rate);
}

/** Indent a block of text by N spaces. */
export function indent(text: string, spaces: number = 4): string {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((l) => l.length ? pad + l : l).join("\n");
}

// ---------- Config block builders ----------

/** Build the http-level gzip block. */
export function buildGzipBlock(): string {
  return `# gzip compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_min_length 256;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/x-javascript
    application/json
    application/xml
    application/xml+rss
    application/rss+xml
    application/atom+xml
    image/svg+xml;`;
}

/** Build the security headers block (for server context). */
export function buildSecurityHeadersBlock(csp: string, hstsMaxAge: number, ssl: boolean): string {
  const lines: string[] = [
    "# security headers",
    'add_header X-Frame-Options "SAMEORIGIN" always;',
    'add_header X-Content-Type-Options "nosniff" always;',
    'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    'add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;',
  ];
  if (csp) {
    lines.push(`add_header Content-Security-Policy "${csp}" always;`);
  }
  if (ssl && hstsMaxAge > 0) {
    lines.push(`add_header Strict-Transport-Security "max-age=${hstsMaxAge}; includeSubDomains; preload" always;`);
  }
  return lines.join("\n");
}

/** Build the SSL block (for server context). */
export function buildSslBlock(certPath: string, keyPath: string): string {
  return `# SSL configuration
listen 443 ssl http2;
listen [::]:443 ssl http2;
ssl_certificate ${certPath};
ssl_certificate_key ${keyPath};
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;`;
}

/** Build the rate limit zone declaration (http context). */
export function buildRateLimitZoneBlock(rate: string): string {
  return `# rate limit zone (http context)
limit_req_zone $binary_remote_addr zone=api:10m rate=${rate};`;
}

/** Build the rate limit apply directive (server/location context). */
export function buildRateLimitApplyBlock(): string {
  return `# apply rate limit
limit_req zone=api burst=20 nodelay;
limit_req_status 429;`;
}

/** Build the HTTP→HTTPS redirect server block. */
export function buildRedirectBlock(domain: string, wwwRedirect: boolean, nonWwwRedirect: boolean): string {
  const lines: string[] = [];
  // Always: 80 → 443 redirect.
  lines.push(`# HTTP → HTTPS redirect`);
  lines.push(`server {`);
  lines.push(`    listen 80;`);
  lines.push(`    listen [::]:80;`);
  lines.push(`    server_name ${domain} ${wwwRedirect || nonWwwRedirect ? toWww(domain) : ""} ${domain};`);
  lines.push(`    return 301 https://$host$request_uri;`);
  lines.push(`}`);
  // www → non-www (or vice versa) on 443.
  if (wwwRedirect) {
    lines.push("");
    lines.push(`# www → non-www redirect (HTTPS)`);
    lines.push(`server {`);
    lines.push(`    listen 443 ssl http2;`);
    lines.push(`    listen [::]:443 ssl http2;`);
    lines.push(`    server_name ${toWww(domain)};`);
    lines.push(`    return 301 https://${domain}$request_uri;`);
    lines.push(`}`);
  }
  if (nonWwwRedirect) {
    lines.push("");
    lines.push(`# non-www → www redirect (HTTPS)`);
    lines.push(`server {`);
    lines.push(`    listen 443 ssl http2;`);
    lines.push(`    listen [::]:443 ssl http2;`);
    lines.push(`    server_name ${stripWww(domain)};`);
    lines.push(`    return 301 https://${toWww(domain)}$request_uri;`);
    lines.push(`}`);
  }
  return lines.join("\n");
}

/** Build an upstream block for load balancing. */
export function buildUpstreamBlock(name: string, upstreams: string[], method: LoadBalancingMethod): string {
  const lines: string[] = [
    `# load-balancing upstream (http context)`,
    `upstream ${name} {`,
  ];
  if (method === "ip-hash") lines.push(`    ip_hash;`);
  if (method === "least-conn") lines.push(`    least_conn;`);
  for (const u of upstreams) {
    lines.push(`    server ${u};`);
  }
  lines.push(`}`);
  return lines.join("\n");
}

/** Build the static site location block. */
export function buildStaticLocationBlock(rootPath: string, indexFile: string, caching: boolean): string {
  const lines: string[] = [
    `root ${rootPath};`,
    `index ${indexFile};`,
    "",
    `location / {`,
    `    try_files $uri $uri/ =404;`,
    `}`,
  ];
  if (caching) {
    lines.push("");
    lines.push(`# browser caching for static assets`);
    lines.push(`location ~* \\.(?:css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {`);
    lines.push(`    expires 30d;`);
    lines.push(`    add_header Cache-Control "public, immutable";`);
    lines.push(`    access_log off;`);
    lines.push(`}`);
  }
  return lines.join("\n");
}

/** Build the SPA location block with try_files → index.html fallback. */
export function buildSpaLocationBlock(rootPath: string, indexFile: string): string {
  return [
    `root ${rootPath};`,
    `index ${indexFile};`,
    "",
    `location / {`,
    `    try_files $uri $uri/ /${indexFile};`,
    `}`,
  ].join("\n");
}

/** Build the PHP-FPM location block. */
export function buildPhpFpmLocationBlock(rootPath: string, upstream: string): string {
  return [
    `root ${rootPath};`,
    `index index.php index.html;`,
    "",
    `location / {`,
    `    try_files $uri $uri/ /index.php?$query_string;`,
    `}`,
    "",
    `location ~ \\.php$ {`,
    `    include fastcgi_params;`,
    `    fastcgi_pass ${upstream};`,
    `    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;`,
    `    fastcgi_index index.php;`,
    `    fastcgi_buffers 16 16k;`,
    `    fastcgi_buffer_size 32k;`,
    `}`,
    "",
    `location ~ /\\.(?!well-known).* {`,
    `    deny all;`,
    `}`,
  ].join("\n");
}

/** Build the Node reverse-proxy location block. */
export function buildNodeProxyLocationBlock(upstream: string, websocket: boolean): string {
  const lines: string[] = [
    `location / {`,
    `    proxy_pass http://${upstream};`,
    `    proxy_http_version 1.1;`,
    `    proxy_set_header Host $host;`,
    `    proxy_set_header X-Real-IP $remote_addr;`,
    `    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
    `    proxy_set_header X-Forwarded-Proto $scheme;`,
  ];
  if (websocket) {
    lines.push(`    # WebSocket upgrade`);
    lines.push(`    proxy_set_header Upgrade $http_upgrade;`);
    lines.push(`    proxy_set_header Connection "upgrade";`);
    lines.push(`    proxy_read_timeout 86400;`);
  }
  lines.push(`}`);
  return lines.join("\n");
}

/** Build the WordPress location block. */
export function buildWordpressLocationBlock(rootPath: string, upstream: string): string {
  return [
    `root ${rootPath};`,
    `index index.php index.html;`,
    "",
    `location / {`,
    `    try_files $uri $uri/ /index.php?$args;`,
    `}`,
    "",
    `location ~ \\.php$ {`,
    `    include fastcgi_params;`,
    `    fastcgi_pass ${upstream};`,
    `    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;`,
    `    fastcgi_index index.php;`,
    `}`,
    "",
    `location ~* /\\.(htaccess|htpasswd|git|svn) {`,
    `    deny all;`,
    `}`,
    "",
    `location = /favicon.ico {`,
    `    log_not_found off;`,
    `    access_log off;`,
    `}`,
    "",
    `location = /robots.txt {`,
    `    log_not_found off;`,
    `    access_log off;`,
    `    allow all;`,
    `}`,
  ].join("\n");
}

// ---------- Full config generation ----------

let counter = 0;
function makeUpstreamName(domain: string): string {
  counter += 1;
  const base = domain.replace(/[^a-zA-Z0-9]/g, "_") || "app";
  return `${base}_backend_${counter}`;
}

/** Generate the full Nginx config from options. */
export function generateConfig(opts: NginxOptions): NginxConfig {
  const options: NginxOptions = { ...DEFAULT_OPTIONS, ...opts };
  const domain = normalizeDomain(options.domain) || "example.com";
  const files: ConfigFile[] = [];
  const warnings: RiskWarning[] = [];
  const explanations: DirectiveExplanation[] = [];

  // Validate domain.
  if (!validateDomain(domain)) {
    warnings.push({ level: "danger", message: `Domain "${domain}" does not look like a valid FQDN.`, directive: "server_name" });
  }
  if (options.ssl) {
    if (!options.sslCertPath || !validatePath(options.sslCertPath)) {
      warnings.push({ level: "warn", message: "SSL cert path missing or invalid.", directive: "ssl_certificate" });
    }
    if (!options.sslKeyPath || !validatePath(options.sslKeyPath)) {
      warnings.push({ level: "warn", message: "SSL key path missing or invalid.", directive: "ssl_certificate_key" });
    }
  }
  if (options.template === "php-fpm" || options.template === "wordpress") {
    if (!validateUpstream(options.upstream)) {
      warnings.push({ level: "warn", message: "Upstream for PHP-FPM should be host:port or unix:/path.", directive: "fastcgi_pass" });
    }
  }
  if (options.template === "node-proxy" && !validateUpstream(options.upstream)) {
    warnings.push({ level: "warn", message: "Node upstream should be host:port (e.g. 127.0.0.1:3000).", directive: "proxy_pass" });
  }
  if (options.rateLimit && !validateRate(options.rateLimitRate)) {
    warnings.push({ level: "warn", message: "Rate limit should match Nnr/s or Nnr/m (e.g. 10r/s).", directive: "limit_req_zone" });
  }
  if (options.serverTokens) {
    warnings.push({ level: "warn", message: "server_tokens on leaks nginx version to attackers — disable in production.", directive: "server_tokens" });
  }
  if (options.ssl && options.hstsMaxAge <= 0) {
    warnings.push({ level: "warn", message: "HSTS max-age is 0 — effectively disables HSTS. Set to ≥ 31536000 (1 year).", directive: "Strict-Transport-Security" });
  }
  if (!options.securityHeaders) {
    warnings.push({ level: "warn", message: "Security headers disabled — browsers won't enforce X-Frame-Options, CSP, HSTS, etc." });
  }
  if (options.wwwRedirect && options.nonWwwRedirect) {
    warnings.push({ level: "danger", message: "Both www→non-www and non-www→www redirects are on — this creates a redirect loop." });
  }
  if (options.loadBalancing !== "none" && options.upstreams.length < 2) {
    warnings.push({ level: "warn", message: "Load balancing enabled with fewer than 2 upstreams — no real load balancing occurs." });
  }
  if (!options.ssl && options.securityHeaders && options.hstsMaxAge > 0) {
    warnings.push({ level: "warn", message: "HSTS without SSL has no effect — HSTS only applies to HTTPS." });
  }

  // ---- http context lines (for nginx.conf) ----
  const httpLines: string[] = [
    "# http context",
    "http {",
    "    ##",
    "    # Basic",
    "    ##",
    "    sendfile on;",
    "    tcp_nopush on;",
    "    tcp_nodelay on;",
    "    keepalive_timeout 65;",
    "    types_hash_max_size 2048;",
    `    server_tokens ${options.serverTokens ? "on" : "off"};`,
    "    server_names_hash_bucket_size 64;",
    "",
    "    include /etc/nginx/mime.types;",
    "    default_type application/octet-stream;",
    "",
    "    ##",
    "    # Logging",
    "    ##",
    '    log_format main \'$remote_addr - $remote_user [$time_local] "$request" \'',
    "                      '$status $body_bytes_sent \"$http_referer\" '",
    "                      '\"$http_user_agent\" \"$http_x_forwarded_for\"';",
    "    access_log /var/log/nginx/access.log main;",
    "    error_log /var/log/nginx/error.log warn;",
  ];
  explanations.push({ directive: "server_tokens", value: options.serverTokens ? "on" : "off", explanation: "Hides nginx version in error pages and Server header for security through obscurity (still recommended)." });

  if (options.gzip) {
    httpLines.push("");
    httpLines.push(indent(buildGzipBlock(), 4));
    explanations.push({ directive: "gzip", value: "on", explanation: "Compresses responses to save bandwidth and speed up page loads for text-based content." });
  }

  if (options.rateLimit) {
    httpLines.push("");
    httpLines.push(indent(buildRateLimitZoneBlock(options.rateLimitRate), 4));
    explanations.push({ directive: "limit_req_zone", value: options.rateLimitRate, explanation: "Defines a shared memory zone for per-IP request rate limiting." });
  }

  let upstreamName = "";
  if (options.loadBalancing !== "none" && options.upstreams.length >= 2) {
    upstreamName = makeUpstreamName(domain);
    httpLines.push("");
    httpLines.push(indent(buildUpstreamBlock(upstreamName, options.upstreams, options.loadBalancing), 4));
    explanations.push({ directive: "upstream", value: upstreamName, explanation: `Load-balances across ${options.upstreams.length} backends using ${options.loadBalancing}.` });
  }

  httpLines.push("");
  httpLines.push("    include /etc/nginx/conf.d/*.conf;");
  httpLines.push("}");

  files.push({
    path: "/etc/nginx/nginx.conf",
    content: `# Generated by UnQTools AI Nginx Config Rule Builder
# Review with \`nginx -t\` before reload.
user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

${httpLines.join("\n")}
`,
    description: "Main nginx.conf — global settings + http context.",
  });

  // ---- per-site conf (sites-available/example.com.conf) ----
  const siteLines: string[] = [];

  // Redirect block (HTTP→HTTPS, www/non-www)
  if (options.ssl && options.httpToHttps) {
    siteLines.push(buildRedirectBlock(domain, options.wwwRedirect, options.nonWwwRedirect));
    siteLines.push("");
  }

  // Main server block
  const primaryServerName = options.nonWwwRedirect ? toWww(domain) : domain;
  siteLines.push(`# ${TEMPLATE_LABELS[options.template]} server block for ${domain}`);
  siteLines.push("server {");
  if (options.ssl) {
    siteLines.push(indent(buildSslBlock(options.sslCertPath, options.sslKeyPath), 4));
    explanations.push({ directive: "ssl_protocols", value: "TLSv1.2 TLSv1.3", explanation: "Disables legacy SSLv3/TLS 1.0/TLS 1.1 which are vulnerable to POODLE/BEAST attacks." });
    explanations.push({ directive: "ssl_ciphers", value: "ECDHE...", explanation: "Strong Forward-Secrecy cipher suite preferring AES-GCM and CHACHA20-POLY1305." });
    explanations.push({ directive: "ssl_session_cache", value: "shared:SSL:10m", explanation: "10 MB shared cache for TLS session resumption — saves CPU on repeat connections." });
  } else {
    siteLines.push("    listen 80;");
    siteLines.push("    listen [::]:80;");
  }
  siteLines.push(`    server_name ${primaryServerName};`);
  siteLines.push("");

  if (options.securityHeaders) {
    siteLines.push(indent(buildSecurityHeadersBlock(options.csp, options.hstsMaxAge, options.ssl), 4));
    if (options.ssl) {
      explanations.push({ directive: "Strict-Transport-Security", value: `max-age=${options.hstsMaxAge}`, explanation: "HSTS forces browsers to use HTTPS for this domain for the given duration. Preload submits to the HSTS preload list." });
    }
    explanations.push({ directive: "X-Frame-Options", value: "SAMEORIGIN", explanation: "Prevents clickjacking by disallowing your site from being framed off-domain." });
    explanations.push({ directive: "Content-Security-Policy", value: options.csp, explanation: "Restricts which scripts/styles/resources the browser will load — strongest XSS mitigation." });
    siteLines.push("");
  }

  if (options.rateLimit) {
    siteLines.push(indent(buildRateLimitApplyBlock(), 4));
    siteLines.push("");
    explanations.push({ directive: "limit_req", value: `zone=api burst=20 nodelay`, explanation: "Applies the rate limit zone with a burst queue of 20 — excess returns 429." });
  }

  // Template-specific location block.
  const targetUpstream = options.loadBalancing !== "none" && upstreamName ? upstreamName : options.upstream;
  let locationBlock = "";
  switch (options.template) {
    case "static":
      locationBlock = buildStaticLocationBlock(options.rootPath, options.indexFile, options.caching);
      break;
    case "spa":
      locationBlock = buildSpaLocationBlock(options.rootPath, options.indexFile);
      break;
    case "php-fpm":
      locationBlock = buildPhpFpmLocationBlock(options.rootPath, targetUpstream);
      break;
    case "node-proxy":
      locationBlock = buildNodeProxyLocationBlock(targetUpstream, options.websocket);
      break;
    case "wordpress":
      locationBlock = buildWordpressLocationBlock(options.rootPath, targetUpstream);
      break;
  }
  siteLines.push(indent(locationBlock, 4));
  siteLines.push("");

  // Common: hide dotfiles + favicon logging.
  siteLines.push("    location ~ /\\. {");
  siteLines.push("        deny all;");
  siteLines.push("    }");
  siteLines.push("");
  siteLines.push("    location = /favicon.ico {");
  siteLines.push("        log_not_found off;");
  siteLines.push("        access_log off;");
  siteLines.push("    }");
  siteLines.push("}");

  files.push({
    path: `/etc/nginx/sites-available/${domain}.conf`,
    content: `# Generated by UnQTools AI Nginx Config Rule Builder
# Symlink to sites-enabled: ln -s /etc/nginx/sites-available/${domain}.conf /etc/nginx/sites-enabled/
# Test: nginx -t && systemctl reload nginx

${siteLines.join("\n")}
`,
    description: `Site config for ${domain} (${TEMPLATE_LABELS[options.template]}).`,
  });

  // ---- Optional: Let's Encrypt snippet reference doc ----
  if (options.ssl) {
    files.push({
      path: "/etc/nginx/snippets/letsencrypt-acme-challenge.conf",
      content: `# ACME challenge location for Let's Encrypt cert renewal.
# Include inside your :80 server block: include snippets/letsencrypt-acme-challenge.conf;
location ^~ /.well-known/acme-challenge/ {
    default_type "text/plain";
    root /var/www/letsencrypt;
}
`,
      description: "Optional snippet for Let's Encrypt HTTP-01 challenge.",
    });
  }

  // All-ok flag if no warnings.
  if (warnings.length === 0) {
    warnings.push({ level: "ok", message: "No risk warnings — config follows current best practices. Still run `nginx -t` before reload." });
  }

  return { options, files, warnings, explanations };
}

// ---------- Linter ----------

export function lintConfig(config: NginxConfig): RiskWarning[] {
  return config.warnings;
}

/** Count warnings by level. */
export function countWarnings(warnings: RiskWarning[]): { ok: number; warn: number; danger: number } {
  return {
    ok: warnings.filter((w) => w.level === "ok").length,
    warn: warnings.filter((w) => w.level === "warn").length,
    danger: warnings.filter((w) => w.level === "danger").length,
  };
}

// ---------- Rendering ----------

/** Render all files as a single concatenated text (with file headers). */
export function renderText(config: NginxConfig): string {
  return config.files.map((f) => {
    return `# === ${f.path} ===\n# ${f.description}\n\n${f.content}`;
  }).join("\n\n---\n\n");
}

/** Render as CSV: path,description,content (one row per file). */
export function renderCsv(config: NginxConfig): string {
  const lines = ["path,description,content"];
  for (const f of config.files) {
    lines.push([
      escapeCsv(f.path),
      escapeCsv(f.description),
      escapeCsv(f.content),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(options: Partial<NginxOptions>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(options)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { options: {} };
  const params = new URLSearchParams(clean);
  const options: Partial<NginxOptions> = {};
  const boolKeys: (keyof NginxOptions)[] = [
    "wwwRedirect", "nonWwwRedirect", "ssl", "httpToHttps",
    "gzip", "caching", "rateLimit", "securityHeaders", "websocket", "serverTokens",
  ];
  const numKeys: (keyof NginxOptions)[] = ["hstsMaxAge"];
  const validTemplates = Object.keys(TEMPLATE_LABELS) as TemplateId[];
  const validLb = ["none", "round-robin", "ip-hash", "least-conn"] as LoadBalancingMethod[];
  const stringKeys: (keyof NginxOptions)[] = [
    "domain", "upstream", "sslCertPath", "sslKeyPath",
    "rootPath", "indexFile", "rateLimitRate", "csp",
  ];
  for (const [k, v] of params.entries()) {
    const key = k as keyof NginxOptions;
    if (boolKeys.includes(key)) {
      (options as Record<string, unknown>)[k] = v === "true" || v === "1";
    } else if (numKeys.includes(key)) {
      (options as Record<string, unknown>)[k] = parseInt(v, 10) || 0;
    } else if (key === "template") {
      if (validTemplates.includes(v as TemplateId)) {
        (options as Record<string, unknown>)[k] = v as TemplateId;
      }
      // else: skip — invalid template value filtered out.
    } else if (key === "loadBalancing") {
      if (validLb.includes(v as LoadBalancingMethod)) {
        (options as Record<string, unknown>)[k] = v as LoadBalancingMethod;
      }
    } else if (key === "upstreams") {
      (options as Record<string, unknown>)[k] = v.split(",").filter(Boolean);
    } else if (stringKeys.includes(key)) {
      (options as Record<string, unknown>)[key] = v;
    }
    // Unknown keys are ignored.
  }
  return { options };
}

// ---------- LLM prompt (BYO key) ----------

export function buildLlmPrompt(options: NginxOptions): LlmPrompt {
  return {
    system: "You are a senior DevOps engineer specializing in nginx configuration. Generate a production-ready, secure nginx.conf based on the user's intent. Always explain each directive on the line above as a # comment. Output only nginx config — no markdown fences, no preamble.",
    user: `Generate an nginx config with these requirements:
- Template: ${TEMPLATE_LABELS[options.template]}
- Domain: ${options.domain}
- Upstream: ${options.upstream}
- SSL: ${options.ssl ? "yes" : "no"}
- HTTP→HTTPS redirect: ${options.httpToHttps ? "yes" : "no"}
- www redirect: ${options.wwwRedirect ? "www→non-www" : options.nonWwwRedirect ? "non-www→www" : "none"}
- gzip: ${options.gzip ? "yes" : "no"}
- caching: ${options.caching ? "yes" : "no"}
- rate limiting: ${options.rateLimit ? `yes (${options.rateLimitRate})` : "no"}
- security headers: ${options.securityHeaders ? "yes" : "no"}
- load balancing: ${options.loadBalancing} (upstreams: ${options.upstreams.join(", ")})
- WebSocket: ${options.websocket ? "yes" : "no"}

Include best-practice security defaults: TLS 1.2+ only, HSTS, X-Frame-Options, X-Content-Type-Options, CSP. Disable server_tokens.`,
  };
}

export function renderLlmResult(raw: string): string {
  // Strip markdown fences if present.
  return raw.replace(/^```[\w]*\n?/g, "").replace(/\n?```$/g, "").trim();
}

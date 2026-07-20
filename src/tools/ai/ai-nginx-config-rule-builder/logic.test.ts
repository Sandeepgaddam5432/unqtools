import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  TEMPLATE_LABELS,
  TEMPLATE_DESCRIPTIONS,
  DEFAULT_OPTIONS,
  DOMAIN_PRESETS,
  UPSTREAM_PRESETS,
  validateDomain,
  normalizeDomain,
  toWww,
  stripWww,
  validatePath,
  validateUpstream,
  validateRate,
  indent,
  buildGzipBlock,
  buildSecurityHeadersBlock,
  buildSslBlock,
  buildRateLimitZoneBlock,
  buildRateLimitApplyBlock,
  buildRedirectBlock,
  buildUpstreamBlock,
  buildStaticLocationBlock,
  buildSpaLocationBlock,
  buildPhpFpmLocationBlock,
  buildNodeProxyLocationBlock,
  buildWordpressLocationBlock,
  generateConfig,
  lintConfig,
  countWarnings,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type NginxOptions,
  type TemplateId,
  type LoadBalancingMethod,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("nginx-config-builder constants", () => {
  it("has 5 template labels", () => {
    expect(Object.keys(TEMPLATE_LABELS)).toHaveLength(5);
    expect(TEMPLATE_LABELS["static"]).toBe("Static site");
    expect(TEMPLATE_LABELS["wordpress"]).toBe("WordPress");
  });

  it("has descriptions for each template", () => {
    for (const k of Object.keys(TEMPLATE_LABELS) as TemplateId[]) {
      expect(TEMPLATE_DESCRIPTIONS[k].length).toBeGreaterThan(0);
    }
  });

  it("exposes DEFAULT_OPTIONS with sensible defaults", () => {
    expect(DEFAULT_OPTIONS.template).toBe("static");
    expect(DEFAULT_OPTIONS.ssl).toBe(true);
    expect(DEFAULT_OPTIONS.serverTokens).toBe(false);
    expect(DEFAULT_OPTIONS.hstsMaxAge).toBe(31536000);
  });

  it("has domain + upstream presets", () => {
    expect(DOMAIN_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(UPSTREAM_PRESETS.length).toBeGreaterThanOrEqual(2);
  });

  it("exposes HISTORY_KEY and HISTORY_MAX=20", () => {
    expect(HISTORY_KEY).toContain("nginx-config-builder");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("nginx-config-builder validators", () => {
  it("validateDomain accepts valid domains", () => {
    expect(validateDomain("example.com")).toBe(true);
    expect(validateDomain("api.example.com")).toBe(true);
    expect(validateDomain("sub.domain.example.co.uk")).toBe(true);
  });

  it("validateDomain rejects invalid domains", () => {
    expect(validateDomain("")).toBe(false);
    expect(validateDomain("notadomain")).toBe(false);
    expect(validateDomain("has space.com")).toBe(false);
    expect(validateDomain("-leading.com")).toBe(false);
    expect(validateDomain("a.b")).toBe(false); // TLD too short
  });

  it("normalizeDomain lowercases and strips trailing dot", () => {
    expect(normalizeDomain("  EXAMPLE.COM.  ")).toBe("example.com");
  });

  it("toWww adds www prefix", () => {
    expect(toWww("example.com")).toBe("www.example.com");
    expect(toWww("www.example.com")).toBe("www.example.com");
  });

  it("stripWww removes www prefix", () => {
    expect(stripWww("www.example.com")).toBe("example.com");
    expect(stripWww("example.com")).toBe("example.com");
  });

  it("validatePath accepts absolute paths", () => {
    expect(validatePath("/var/www/example.com")).toBe(true);
    expect(validatePath("/etc/letsencrypt/live/example.com/fullchain.pem")).toBe(true);
  });

  it("validatePath rejects relative paths and shell metachars", () => {
    expect(validatePath("relative/path")).toBe(false);
    expect(validatePath("/var/www; rm -rf /")).toBe(false);
    expect(validatePath("/var/www && cat /etc/passwd")).toBe(false);
    expect(validatePath("")).toBe(false);
  });

  it("validateUpstream accepts host:port", () => {
    expect(validateUpstream("127.0.0.1:3000")).toBe(true);
    expect(validateUpstream("localhost:8080")).toBe(true);
    expect(validateUpstream("10.0.0.1:443")).toBe(true);
  });

  it("validateUpstream accepts unix socket", () => {
    expect(validateUpstream("unix:/var/run/php/php-fpm.sock")).toBe(true);
  });

  it("validateUpstream rejects invalid", () => {
    expect(validateUpstream("")).toBe(false);
    expect(validateUpstream("not_a_socket")).toBe(false);
    expect(validateUpstream("localhost:99999")).toBe(false); // port out of range
  });

  it("validateRate accepts Nnr/s and Nnr/m", () => {
    expect(validateRate("10r/s")).toBe(true);
    expect(validateRate("60r/m")).toBe(true);
    expect(validateRate("100r/s")).toBe(true);
  });

  it("validateRate rejects invalid formats", () => {
    expect(validateRate("")).toBe(false);
    expect(validateRate("10")).toBe(false);
    expect(validateRate("10/s")).toBe(false);
    expect(validateRate("10r/h")).toBe(false); // only s/m
  });

  it("indent pads each line", () => {
    expect(indent("a\nb\nc", 4)).toBe("    a\n    b\n    c");
  });
});

describe("nginx-config-builder block builders", () => {
  it("buildGzipBlock includes gzip on and types", () => {
    const b = buildGzipBlock();
    expect(b).toContain("gzip on");
    expect(b).toContain("gzip_types");
    expect(b).toContain("text/plain");
  });

  it("buildSecurityHeadersBlock includes core headers", () => {
    const b = buildSecurityHeadersBlock("default-src 'self'", 31536000, true);
    expect(b).toContain("X-Frame-Options");
    expect(b).toContain("X-Content-Type-Options");
    expect(b).toContain("Referrer-Policy");
    expect(b).toContain("Content-Security-Policy");
    expect(b).toContain("Strict-Transport-Security");
    expect(b).toContain("max-age=31536000");
  });

  it("buildSecurityHeadersBlock omits HSTS when ssl=false", () => {
    const b = buildSecurityHeadersBlock("", 31536000, false);
    expect(b).not.toContain("Strict-Transport-Security");
  });

  it("buildSslBlock includes TLS 1.2 + 1.3", () => {
    const b = buildSslBlock("/cert.pem", "/key.pem");
    expect(b).toContain("listen 443 ssl http2");
    expect(b).toContain("ssl_protocols TLSv1.2 TLSv1.3");
    expect(b).toContain("ssl_certificate /cert.pem");
    expect(b).toContain("ssl_certificate_key /key.pem");
    expect(b).not.toContain("SSLv3");
  });

  it("buildRateLimitZoneBlock includes zone + rate", () => {
    const b = buildRateLimitZoneBlock("10r/s");
    expect(b).toContain("limit_req_zone");
    expect(b).toContain("zone=api:10m");
    expect(b).toContain("rate=10r/s");
  });

  it("buildRateLimitApplyBlock includes burst + status", () => {
    const b = buildRateLimitApplyBlock();
    expect(b).toContain("limit_req zone=api burst=20");
    expect(b).toContain("limit_req_status 429");
  });

  it("buildRedirectBlock includes HTTP→HTTPS redirect", () => {
    const b = buildRedirectBlock("example.com", true, false);
    expect(b).toContain("listen 80");
    expect(b).toContain("return 301 https://$host$request_uri");
  });

  it("buildRedirectBlock includes www→non-www redirect", () => {
    const b = buildRedirectBlock("example.com", true, false);
    expect(b).toContain("www.example.com");
    expect(b).toContain("return 301 https://example.com$request_uri");
  });

  it("buildRedirectBlock includes non-www→www redirect", () => {
    const b = buildRedirectBlock("example.com", false, true);
    expect(b).toContain("return 301 https://www.example.com$request_uri");
  });

  it("buildUpstreamBlock lists all upstreams", () => {
    const b = buildUpstreamBlock("my_backend", ["10.0.0.1:3000", "10.0.0.2:3000"], "round-robin");
    expect(b).toContain("upstream my_backend");
    expect(b).toContain("server 10.0.0.1:3000");
    expect(b).toContain("server 10.0.0.2:3000");
  });

  it("buildUpstreamBlock supports ip-hash", () => {
    const b = buildUpstreamBlock("my_backend", ["10.0.0.1:3000", "10.0.0.2:3000"], "ip-hash");
    expect(b).toContain("ip_hash");
  });

  it("buildUpstreamBlock supports least-conn", () => {
    const b = buildUpstreamBlock("my_backend", ["10.0.0.1:3000", "10.0.0.2:3000"], "least-conn");
    expect(b).toContain("least_conn");
  });

  it("buildStaticLocationBlock includes try_files and caching", () => {
    const b = buildStaticLocationBlock("/var/www/site", "index.html", true);
    expect(b).toContain("root /var/www/site");
    expect(b).toContain("index index.html");
    expect(b).toContain("try_files $uri $uri/ =404");
    expect(b).toContain("expires 30d");
  });

  it("buildSpaLocationBlock uses index.html fallback", () => {
    const b = buildSpaLocationBlock("/var/www/app", "index.html");
    expect(b).toContain("try_files $uri $uri/ /index.html");
  });

  it("buildPhpFpmLocationBlock includes fastcgi_pass", () => {
    const b = buildPhpFpmLocationBlock("/var/www/php", "unix:/var/run/php/php-fpm.sock");
    expect(b).toContain("fastcgi_pass unix:/var/run/php/php-fpm.sock");
    expect(b).toContain("SCRIPT_FILENAME");
    expect(b).toContain("deny all"); // hidden files
  });

  it("buildNodeProxyLocationBlock includes proxy_pass and headers", () => {
    const b = buildNodeProxyLocationBlock("127.0.0.1:3000", false);
    expect(b).toContain("proxy_pass http://127.0.0.1:3000");
    expect(b).toContain("X-Real-IP");
    expect(b).toContain("X-Forwarded-For");
  });

  it("buildNodeProxyLocationBlock adds WebSocket headers when enabled", () => {
    const b = buildNodeProxyLocationBlock("127.0.0.1:3000", true);
    expect(b).toContain("Upgrade $http_upgrade");
    expect(b).toContain("Connection \"upgrade\"");
    expect(b).toContain("proxy_read_timeout 86400");
  });

  it("buildWordpressLocationBlock includes /index.php fallback", () => {
    const b = buildWordpressLocationBlock("/var/www/wp", "unix:/var/run/php/php-fpm.sock");
    expect(b).toContain("try_files $uri $uri/ /index.php?$args");
    expect(b).toContain("fastcgi_pass");
    expect(b).toContain("robots.txt");
  });
});

describe("nginx-config-builder generateConfig", () => {
  it("generates a config with multiple files for static + SSL", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS,
      template: "static",
      domain: "example.com",
      ssl: true,
    });
    expect(cfg.files.length).toBeGreaterThanOrEqual(2);
    expect(cfg.files.some((f) => f.path === "/etc/nginx/nginx.conf")).toBe(true);
    expect(cfg.files.some((f) => f.path === "/etc/nginx/sites-available/example.com.conf")).toBe(true);
  });

  it("generates Node reverse-proxy config", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS,
      template: "node-proxy",
      domain: "api.example.com",
      upstream: "127.0.0.1:3000",
      websocket: true,
    });
    const site = cfg.files.find((f) => f.path.includes("api.example.com.conf"));
    expect(site).toBeDefined();
    expect(site!.content).toContain("proxy_pass http://127.0.0.1:3000");
    expect(site!.content).toContain("Upgrade $http_upgrade");
  });

  it("generates PHP-FPM config", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS,
      template: "php-fpm",
      domain: "app.example.com",
      upstream: "unix:/var/run/php/php8.2-fpm.sock",
    });
    const site = cfg.files.find((f) => f.path.includes("app.example.com.conf"));
    expect(site).toBeDefined();
    expect(site!.content).toContain("fastcgi_pass unix:/var/run/php/php8.2-fpm.sock");
  });

  it("generates WordPress config", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS,
      template: "wordpress",
      domain: "blog.example.com",
      upstream: "unix:/var/run/php/php-fpm.sock",
    });
    const site = cfg.files.find((f) => f.path.includes("blog.example.com.conf"));
    expect(site!.content).toContain("try_files $uri $uri/ /index.php?$args");
  });

  it("generates SPA config with try_files fallback", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS,
      template: "spa",
      domain: "app.example.com",
    });
    const site = cfg.files.find((f) => f.path.includes("app.example.com.conf"));
    expect(site!.content).toContain("try_files $uri $uri/ /index.html");
  });

  it("includes SSL block when ssl=true", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, ssl: true, domain: "example.com" });
    const main = cfg.files.find((f) => f.path === "/etc/nginx/sites-available/example.com.conf");
    expect(main!.content).toContain("listen 443 ssl http2");
    expect(main!.content).toContain("ssl_protocols TLSv1.2 TLSv1.3");
  });

  it("omits SSL block when ssl=false", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, ssl: false, domain: "example.com", securityHeaders: false });
    const main = cfg.files.find((f) => f.path === "/etc/nginx/sites-available/example.com.conf");
    expect(main!.content).toContain("listen 80;");
    expect(main!.content).not.toContain("listen 443 ssl");
  });

  it("includes HTTP→HTTPS redirect when httpToHttps=true", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, ssl: true, httpToHttps: true, domain: "example.com" });
    const main = cfg.files.find((f) => f.path === "/etc/nginx/sites-available/example.com.conf");
    expect(main!.content).toContain("return 301 https://$host$request_uri");
  });

  it("includes gzip block in nginx.conf when gzip=true", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, gzip: true, domain: "example.com" });
    const main = cfg.files.find((f) => f.path === "/etc/nginx/nginx.conf");
    expect(main!.content).toContain("gzip on");
    expect(main!.content).toContain("gzip_types");
  });

  it("includes rate limiting in nginx.conf when rateLimit=true", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, rateLimit: true, rateLimitRate: "10r/s", domain: "example.com" });
    const main = cfg.files.find((f) => f.path === "/etc/nginx/nginx.conf");
    expect(main!.content).toContain("limit_req_zone");
    const site = cfg.files.find((f) => f.path === "/etc/nginx/sites-available/example.com.conf");
    expect(site!.content).toContain("limit_req zone=api burst=20");
  });

  it("includes security headers when securityHeaders=true", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, securityHeaders: true, domain: "example.com" });
    const site = cfg.files.find((f) => f.path === "/etc/nginx/sites-available/example.com.conf");
    expect(site!.content).toContain("X-Frame-Options");
    expect(site!.content).toContain("Content-Security-Policy");
  });

  it("includes load balancing upstream when configured", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS,
      template: "node-proxy",
      domain: "api.example.com",
      upstream: "127.0.0.1:3000",
      loadBalancing: "ip-hash",
      upstreams: ["10.0.0.1:3000", "10.0.0.2:3000"],
    });
    const main = cfg.files.find((f) => f.path === "/etc/nginx/nginx.conf");
    expect(main!.content).toContain("upstream ");
    expect(main!.content).toContain("ip_hash");
    expect(main!.content).toContain("server 10.0.0.1:3000");
  });

  it("includes per-directive explanations", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, ssl: true, securityHeaders: true, domain: "example.com" });
    expect(cfg.explanations.length).toBeGreaterThan(3);
    expect(cfg.explanations.some((e) => e.directive === "ssl_protocols")).toBe(true);
    expect(cfg.explanations.some((e) => e.directive === "server_tokens")).toBe(true);
    expect(cfg.explanations.some((e) => e.directive === "X-Frame-Options")).toBe(true);
  });
});

describe("nginx-config-builder linting + warnings", () => {
  it("warns on invalid domain", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, domain: "not_a_domain" });
    expect(cfg.warnings.some((w) => w.message.includes("does not look like a valid FQDN"))).toBe(true);
  });

  it("warns on server_tokens on", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, serverTokens: true, domain: "example.com" });
    expect(cfg.warnings.some((w) => w.message.includes("server_tokens on leaks nginx version"))).toBe(true);
  });

  it("danger flag on conflicting redirects (www + non-www)", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS, wwwRedirect: true, nonWwwRedirect: true, domain: "example.com",
    });
    expect(cfg.warnings.some((w) => w.level === "danger" && w.message.includes("redirect loop"))).toBe(true);
  });

  it("warns on load balancing with < 2 upstreams", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS, loadBalancing: "ip-hash", upstreams: ["10.0.0.1:3000"], domain: "example.com",
    });
    expect(cfg.warnings.some((w) => w.message.includes("fewer than 2 upstreams"))).toBe(true);
  });

  it("warns on HSTS without SSL", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS, ssl: false, securityHeaders: true, hstsMaxAge: 31536000, domain: "example.com",
    });
    expect(cfg.warnings.some((w) => w.message.includes("HSTS without SSL"))).toBe(true);
  });

  it("returns ok warning when no issues", () => {
    const cfg = generateConfig({
      ...DEFAULT_OPTIONS,
      domain: "example.com",
      ssl: true, securityHeaders: true, wwwRedirect: true, nonWwwRedirect: false,
      serverTokens: false, rateLimit: false,
    });
    // Even on ok config, there should be at least the "ok" warning.
    expect(cfg.warnings.some((w) => w.level === "ok")).toBe(true);
  });

  it("lintConfig returns the same warnings", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, serverTokens: true, domain: "example.com" });
    expect(lintConfig(cfg)).toBe(cfg.warnings);
  });

  it("countWarnings returns counts by level", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, serverTokens: true, wwwRedirect: true, nonWwwRedirect: true, domain: "example.com" });
    const counts = countWarnings(cfg.warnings);
    expect(counts.warn + counts.danger + counts.ok).toBe(cfg.warnings.length);
    expect(counts.warn).toBeGreaterThan(0);
    expect(counts.danger).toBeGreaterThan(0);
  });
});

describe("nginx-config-builder rendering", () => {
  it("renderText includes file paths and content", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, domain: "example.com" });
    const txt = renderText(cfg);
    expect(txt).toContain("/etc/nginx/nginx.conf");
    expect(txt).toContain("/etc/nginx/sites-available/example.com.conf");
    expect(txt).toContain("server {");
  });

  it("renderCsv outputs header + all file paths", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, domain: "example.com" });
    const csv = renderCsv(cfg);
    // First line is the header.
    expect(csv.split("\n")[0]).toBe("path,description,content");
    // Every file's path appears in the CSV (multi-line content may span extra rows).
    for (const f of cfg.files) {
      expect(csv).toContain(f.path);
    }
  });

  it("renderCsv escapes commas in content", () => {
    const cfg = generateConfig({ ...DEFAULT_OPTIONS, domain: "example.com", csp: "default-src 'self', test" });
    const csv = renderCsv(cfg);
    expect(csv).toContain('"');
  });
});

describe("nginx-config-builder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      template: "static",
      domain: "example.com",
      upstream: "127.0.0.1:3000",
      ssl: true,
      fileCount: 3,
      warningCount: 1,
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].domain).toBe("example.com");
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, template: "static", domain: `d${i}.com`, upstream: "",
        ssl: false, fileCount: 2, warningCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1, template: "static", domain: "x", upstream: "",
      ssl: false, fileCount: 1, warningCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("nginx-config-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ domain: "example.com", ssl: true, template: "static" });
    expect(url).toContain("domain=example.com");
    expect(url).toContain("ssl=true");
    expect(url).toContain("template=static");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("domain=example.com&ssl=true&template=node-proxy&loadBalancing=ip-hash&upstreams=10.0.0.1:3000,10.0.0.2:3000");
    expect(p.options.domain).toBe("example.com");
    expect(p.options.ssl).toBe(true);
    expect(p.options.template).toBe("node-proxy");
    expect(p.options.loadBalancing).toBe("ip-hash");
    expect(p.options.upstreams).toEqual(["10.0.0.1:3000", "10.0.0.2:3000"]);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ options: {} });
  });

  it("filters unknown template values", () => {
    const p = parseShareUrl("template=invalid-template");
    expect(p.options.template).toBeUndefined();
  });

  it("parses numeric hstsMaxAge", () => {
    const p = parseShareUrl("hstsMaxAge=12345");
    expect(p.options.hstsMaxAge).toBe(12345);
  });
});

describe("nginx-config-builder LLM prompt", () => {
  it("buildLlmPrompt returns system + user with all options", () => {
    const p = buildLlmPrompt({ ...DEFAULT_OPTIONS, domain: "example.com", template: "node-proxy" });
    expect(p.system).toContain("DevOps engineer");
    expect(p.user).toContain("Node reverse proxy");
    expect(p.user).toContain("example.com");
    expect(p.user).toContain("TLS 1.2+");
  });

  it("renderLlmResult strips markdown fences", () => {
    const raw = "```nginx\nserver {\n    listen 80;\n}\n```";
    expect(renderLlmResult(raw)).toBe("server {\n    listen 80;\n}");
  });

  it("renderLlmResult handles non-fenced content", () => {
    expect(renderLlmResult("server { listen 80; }")).toBe("server { listen 80; }");
  });
});

// Suppress unused-import lint
export type _Unused = NginxOptions | TemplateId | LoadBalancingMethod;

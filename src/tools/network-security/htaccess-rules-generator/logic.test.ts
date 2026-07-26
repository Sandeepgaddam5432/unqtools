/**
 * .htaccess Rules Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateHtaccess, sampleHtpasswdLine, describeHeader, type HtaccessConfig } from "./logic";

describe("generateHtaccess — validation", () => {
  it("errors when auth block missing htpasswdPath", () => {
    expect("error" in generateHtaccess({ auth: { realm: "x", htpasswdPath: "" } })).toBe(true);
  });
});

describe("generateHtaccess — directory listing & default page", () => {
  it("disables directory listing", () => {
    const r = generateHtaccess({ directoryListing: false });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("Options -Indexes");
  });
  it("enables directory listing", () => {
    const r = generateHtaccess({ directoryListing: true });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("Options +Indexes");
  });
  it("sets default page", () => {
    const r = generateHtaccess({ defaultPage: "index.html" });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("DirectoryIndex index.html");
  });
});

describe("generateHtaccess — redirects", () => {
  it("emits 301 by default", () => {
    const r = generateHtaccess({ redirects: [{ from: "/old", to: "/new" }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("Redirect 301 /old /new");
  });
  it("emits 302 when permanent=false", () => {
    const r = generateHtaccess({ redirects: [{ from: "/old", to: "/new", permanent: false }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("Redirect 302 /old /new");
  });
});

describe("generateHtaccess — auth", () => {
  it("emits auth block with realm and path", () => {
    const r = generateHtaccess({ auth: { realm: "Members", htpasswdPath: "/var/.htpasswd" } });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("AuthType Basic");
    expect(r.content).toContain('AuthName "Members"');
    expect(r.content).toContain("AuthUserFile /var/.htpasswd");
  });
  it("warns when path doesn't end in .htpasswd", () => {
    const r = generateHtaccess({ auth: { realm: "x", htpasswdPath: "/etc/passwd" } });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes(".htpasswd"))).toBe(true);
  });
});

describe("generateHtaccess — IP rules", () => {
  it("emits allow and deny lines", () => {
    const r = generateHtaccess({
      ipRules: [
        { ip: "192.168.1.1", action: "allow" },
        { ip: "10.0.0.0/8", action: "deny" },
      ],
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("Allow from 192.168.1.1");
    expect(r.content).toContain("Deny from 10.0.0.0/8");
  });
  it("adds 'Allow from all' when only allows", () => {
    const r = generateHtaccess({ ipRules: [{ ip: "1.2.3.4", action: "allow" }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("Allow from all");
  });
  it("warns on invalid IP", () => {
    const r = generateHtaccess({ ipRules: [{ ip: "not-an-ip", action: "deny" }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("not-an-ip"))).toBe(true);
  });
});

describe("generateHtaccess — security headers", () => {
  it("emits CSP header", () => {
    const r = generateHtaccess({ securityHeaders: ["csp"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("Content-Security-Policy");
    expect(r.content).toContain("mod_headers");
  });
  it("emits HSTS header", () => {
    const r = generateHtaccess({ securityHeaders: ["hsts"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("Strict-Transport-Security");
  });
  it("emits all 6 headers", () => {
    const r = generateHtaccess({ securityHeaders: ["csp", "xFrameOptions", "xContentTypeOptions", "hsts", "referrerPolicy", "permissionsPolicy"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("X-Frame-Options");
    expect(r.content).toContain("X-Content-Type-Options");
    expect(r.content).toContain("Referrer-Policy");
    expect(r.content).toContain("Permissions-Policy");
  });
});

describe("generateHtaccess — rewrite rules", () => {
  it("emits force HTTPS", () => {
    const r = generateHtaccess({ rewriteRules: ["forceHttps"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("RewriteEngine On");
    expect(r.content).toContain("https://%{HTTP_HOST}");
  });
  it("emits www → non-www", () => {
    const r = generateHtaccess({ rewriteRules: ["wwwToNonWww"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("^www\\.(.+)$");
  });
  it("emits non-www → www", () => {
    const r = generateHtaccess({ rewriteRules: ["nonWwwToWww"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("!^www\\.");
  });
});

describe("generateHtaccess — pretty URLs", () => {
  it("emits pretty URL rule", () => {
    const r = generateHtaccess({ prettyUrls: { pattern: "^post/([0-9]+)$", target: "/post.php?id=$1" } });
    if ("error" in r) throw new Error("should not error");
    expect(r.content).toContain("RewriteRule ^post/([0-9]+)$ /post.php?id=$1");
  });
  it("warns when pattern doesn't start with ^", () => {
    const r = generateHtaccess({ prettyUrls: { pattern: "post/([0-9]+)", target: "/post.php?id=$1" } });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("^"))).toBe(true);
  });
});

describe("helpers", () => {
  it("sampleHtpasswdLine includes username and instructions", () => {
    const line = sampleHtpasswdLine("alice");
    expect(line).toContain("alice");
    expect(line).toContain("htpasswd");
  });
  it("describeHeader returns a non-empty description", () => {
    expect(describeHeader("csp").length).toBeGreaterThan(10);
    expect(describeHeader("hsts")).toContain("HTTPS");
  });
});

"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { generateHtaccess, parseBulkRedirects, DEFAULT_CONFIG, type HtaccessConfig, type RedirectRule } from "./logic";

export default function HtaccessGenerator() {
  const [config, setConfig] = useState<HtaccessConfig>({
    ...DEFAULT_CONFIG,
    securityHeaders: {},
    directoryListing: "deny",
  });
  const [bulkRedirectInput, setBulkRedirectInput] = useState("/old-page → /new-page\n/about-us → /about");
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<HtaccessConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const addBulkRedirects = useCallback(() => {
    const parsed = parseBulkRedirects(bulkRedirectInput);
    update({ redirects: [...config.redirects, ...parsed] });
  }, [bulkRedirectInput, config.redirects, update]);

  const output = generateHtaccess(config);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.forceHttps} onChange={(e) => update({ forceHttps: e.target.checked })} /><span>Force HTTPS</span></label>
            <label className="flex items-center gap-2">
              <span>WWW:</span>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.forceWww} onChange={(e) => update({ forceWww: e.target.value as "none" | "force" | "prevent" })}>
                <option value="none">No rule</option>
                <option value="force">Force www</option>
                <option value="prevent">Prevent www (force non-www)</option>
              </select>
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.gzipCompression} onChange={(e) => update({ gzipCompression: e.target.checked })} /><span>Gzip compression</span></label>
            <label className="flex items-center gap-2">
              <span>Directory listing:</span>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.directoryListing} onChange={(e) => update({ directoryListing: e.target.value as "allow" | "deny" })}>
                <option value="deny">Deny (recommended)</option>
                <option value="allow">Allow</option>
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Redirects</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono" value={bulkRedirectInput} onChange={(e) => setBulkRedirectInput(e.target.value)} placeholder="/old → /new" />
          <Button size="sm" onClick={addBulkRedirects}>Add redirects from bulk input</Button>
          {config.redirects.length > 0 && (
            <div className="space-y-1">
              {config.redirects.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{r.type}</Badge>
                  <span className="font-mono">{r.from}</span>
                  <span>→</span>
                  <span className="font-mono">{r.to}</span>
                  <Button size="sm" variant="ghost" onClick={() => update({ redirects: config.redirects.filter((_, idx) => idx !== i) })}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">IP access control</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Allowlist (comma-separated IPs/CIDRs)</Label>
              <Input value={config.ipAllowlist.join(", ")} onChange={(e) => update({ ipAllowlist: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="192.168.1.0/24, 10.0.0.5" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Denylist (comma-separated IPs/CIDRs)</Label>
              <Input value={config.ipDenylist.join(", ")} onChange={(e) => update({ ipDenylist: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="10.0.0.0/8" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Custom error pages</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {config.errorPages.map((e, i) => (
            <div key={i} className="flex gap-2">
              <Input type="number" value={e.code} onChange={(ev) => update({ errorPages: config.errorPages.map((p, idx) => idx === i ? { ...p, code: Number(ev.target.value) } : p) })} placeholder="404" className="w-24" />
              <Input value={e.path} onChange={(ev) => update({ errorPages: config.errorPages.map((p, idx) => idx === i ? { ...p, path: ev.target.value } : p) })} placeholder="/404.html" />
              <Button size="sm" variant="ghost" onClick={() => update({ errorPages: config.errorPages.filter((_, idx) => idx !== i) })}>Remove</Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => update({ errorPages: [...config.errorPages, { code: 404, path: "/404.html" }] })}>+ Add error page</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Security headers</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!config.securityHeaders.hsts} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, hsts: e.target.checked ? { maxAge: 31536000, includeSubdomains: true, preload: false } : undefined } })} /><span>Strict-Transport-Security (HSTS)</span></label>
          {config.securityHeaders.hsts && (
            <div className="grid grid-cols-3 gap-3 ml-6">
              <div><Label className="text-xs text-muted-foreground">Max age (sec)</Label><Input type="number" value={config.securityHeaders.hsts.maxAge} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, hsts: { ...config.securityHeaders.hsts!, maxAge: Number(e.target.value) } } })} /></div>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={config.securityHeaders.hsts.includeSubdomains} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, hsts: { ...config.securityHeaders.hsts!, includeSubdomains: e.target.checked } } })} /><span>includeSubDomains</span></label>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={config.securityHeaders.hsts.preload} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, hsts: { ...config.securityHeaders.hsts!, preload: e.target.checked } } })} /><span>preload</span></label>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!config.securityHeaders.xFrameOptions} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, xFrameOptions: e.target.checked ? "SAMEORIGIN" : undefined } })} /><span>X-Frame-Options</span></label>
            {config.securityHeaders.xFrameOptions && (
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.securityHeaders.xFrameOptions} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, xFrameOptions: e.target.value as "DENY" | "SAMEORIGIN" | "ALLOW-FROM" } })}>
                <option value="DENY">DENY</option>
                <option value="SAMEORIGIN">SAMEORIGIN</option>
              </select>
            )}
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!config.securityHeaders.xContentTypeOptions} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, xContentTypeOptions: e.target.checked } })} /><span>X-Content-Type-Options: nosniff</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!config.securityHeaders.xXssProtection} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, xXssProtection: e.target.checked } })} /><span>X-XSS-Protection</span></label>
          </div>
          {config.securityHeaders.xFrameOptions !== undefined && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Content-Security-Policy (optional)</Label>
              <Input value={config.securityHeaders.csp ?? ""} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, csp: e.target.value || undefined } })} placeholder="default-src 'self'; script-src 'self'" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Referrer-Policy (optional)</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={config.securityHeaders.referrerPolicy ?? ""} onChange={(e) => update({ securityHeaders: { ...config.securityHeaders, referrerPolicy: e.target.value || undefined } })}>
              <option value="">(none)</option>
              <option value="no-referrer">no-referrer</option>
              <option value="no-referrer-when-downgrade">no-referrer-when-downgrade (default)</option>
              <option value="same-origin">same-origin</option>
              <option value="origin">origin</option>
              <option value="strict-origin">strict-origin</option>
              <option value="origin-when-cross-origin">origin-when-cross-origin</option>
              <option value="strict-origin-when-cross-origin">strict-origin-when-cross-origin</option>
              <option value="unsafe-url">unsafe-url</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Generated .htaccess</CardTitle>
            <div className="flex gap-2">
              <CopyButton getText={() => output} />
              <DownloadButton getText={() => output} filename=".htaccess" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono max-h-[400px] overflow-auto"><code>{output}</code></pre>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all generation runs locally. No config leaves your browser.</p></CardContent></Card>
    </div>
  );
}

"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  generateHtaccess,
  sampleHtpasswdLine,
  describeHeader,
  type HtaccessConfig,
  type RedirectRule,
  type IpRule,
  type SecurityHeaderFlag,
  type RewriteFlag,
  type HtaccessResult,
} from "./logic";

const ALL_HEADERS: SecurityHeaderFlag[] = ["csp", "xFrameOptions", "xContentTypeOptions", "hsts", "referrerPolicy", "permissionsPolicy"];
const ALL_REWRITES: RewriteFlag[] = ["forceHttps", "wwwToNonWww", "nonWwwToWww", "removeTrailingSlash", "addTrailingSlash", "hidePhpExt"];

export default function HtaccessRulesGenerator() {
  const [directoryListing, setDirectoryListing] = useState<boolean | undefined>(false);
  const [defaultPage, setDefaultPage] = useState("index.html");
  const [redirects, setRedirects] = useState<RedirectRule[]>([{ from: "/old-page", to: "/new-page", permanent: true }]);
  const [authRealm, setAuthRealm] = useState("");
  const [authPath, setAuthPath] = useState("");
  const [ipRules, setIpRules] = useState<IpRule[]>([{ ip: "192.168.1.1", action: "allow" }]);
  const [headers, setHeaders] = useState<SecurityHeaderFlag[]>(["xFrameOptions", "xContentTypeOptions", "hsts"]);
  const [rewrites, setRewrites] = useState<RewriteFlag[]>(["forceHttps"]);
  const [prettyPattern, setPrettyPattern] = useState("^post/([0-9]+)$");
  const [prettyTarget, setPrettyTarget] = useState("/post.php?id=$1");
  const [result, setResult] = useState<HtaccessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleHeader = (h: SecurityHeaderFlag) => setHeaders((p) => p.includes(h) ? p.filter((x) => x !== h) : [...p, h]);
  const toggleRewrite = (r: RewriteFlag) => setRewrites((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r]);

  const run = useCallback(() => {
    const cfg: HtaccessConfig = {
      directoryListing,
      defaultPage: defaultPage.trim() || undefined,
      redirects: redirects.filter((r) => r.from && r.to),
      auth: authPath ? { realm: authRealm, htpasswdPath: authPath } : undefined,
      ipRules: ipRules.filter((r) => r.ip),
      securityHeaders: headers,
      rewriteRules: rewrites,
      prettyUrls: prettyPattern && prettyTarget ? { pattern: prettyPattern, target: prettyTarget } : undefined,
    };
    const r = generateHtaccess(cfg);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [directoryListing, defaultPage, redirects, authRealm, authPath, ipRules, headers, rewrites, prettyPattern, prettyTarget]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Directory listing</Label>
              <div className="flex gap-2">
                <Button size="sm" variant={directoryListing === true ? "default" : "outline"} onClick={() => setDirectoryListing(true)}>On</Button>
                <Button size="sm" variant={directoryListing === false ? "default" : "outline"} onClick={() => setDirectoryListing(false)}>Off</Button>
                <Button size="sm" variant={directoryListing === undefined ? "default" : "outline"} onClick={() => setDirectoryListing(undefined)}>Default</Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Default page</Label>
              <Input value={defaultPage} onChange={(e) => setDefaultPage(e.target.value)} aria-label="Default page" />
            </div>
          </div>

          {/* Redirects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Redirects</Label><Button size="sm" variant="outline" onClick={() => setRedirects((p) => [...p, { from: "", to: "", permanent: true }])}>Add</Button></div>
            {redirects.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4" value={r.from} onChange={(e) => setRedirects((p) => p.map((x, idx) => idx === i ? { ...x, from: e.target.value } : x))} placeholder="/old" aria-label="From" />
                <Input className="col-span-4" value={r.to} onChange={(e) => setRedirects((p) => p.map((x, idx) => idx === i ? { ...x, to: e.target.value } : x))} placeholder="/new" aria-label="To" />
                <Button size="sm" variant={r.permanent !== false ? "default" : "outline"} onClick={() => setRedirects((p) => p.map((x, idx) => idx === i ? { ...x, permanent: x.permanent === false } : x))} className="col-span-2">{r.permanent !== false ? "301" : "302"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setRedirects((p) => p.filter((_, idx) => idx !== i))} className="col-span-2">Remove</Button>
              </div>
            ))}
          </div>

          {/* Auth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Auth realm (optional)</Label>
              <Input value={authRealm} onChange={(e) => setAuthRealm(e.target.value)} placeholder="Members only" aria-label="Auth realm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">.htpasswd path (enables auth)</Label>
              <Input value={authPath} onChange={(e) => setAuthPath(e.target.value)} placeholder="/var/www/.htpasswd" aria-label="htpasswd path" />
            </div>
          </div>

          {/* IP rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">IP allow / deny</Label><Button size="sm" variant="outline" onClick={() => setIpRules((p) => [...p, { ip: "", action: "deny" }])}>Add</Button></div>
            {ipRules.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-8" value={r.ip} onChange={(e) => setIpRules((p) => p.map((x, idx) => idx === i ? { ...x, ip: e.target.value } : x))} placeholder="10.0.0.0/8" aria-label="IP" />
                <Button size="sm" variant={r.action === "allow" ? "default" : "outline"} onClick={() => setIpRules((p) => p.map((x, idx) => idx === i ? { ...x, action: x.action === "allow" ? "deny" : "allow" } : x))} className="col-span-2">{r.action}</Button>
                <Button size="sm" variant="ghost" onClick={() => setIpRules((p) => p.filter((_, idx) => idx !== i))} className="col-span-2">Remove</Button>
              </div>
            ))}
          </div>

          {/* Security headers */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Security headers</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_HEADERS.map((h) => (
                <Button key={h} size="sm" variant={headers.includes(h) ? "default" : "outline"} onClick={() => toggleHeader(h)} title={describeHeader(h)}>{h}</Button>
              ))}
            </div>
          </div>

          {/* Rewrites */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Rewrite rules</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_REWRITES.map((r) => (
                <Button key={r} size="sm" variant={rewrites.includes(r) ? "default" : "outline"} onClick={() => toggleRewrite(r)}>{r}</Button>
              ))}
            </div>
          </div>

          {/* Pretty URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Pretty URL pattern</Label>
              <Input value={prettyPattern} onChange={(e) => setPrettyPattern(e.target.value)} aria-label="Pretty URL pattern" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Pretty URL target</Label>
              <Input value={prettyTarget} onChange={(e) => setPrettyTarget(e.target.value)} aria-label="Pretty URL target" />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Generate .htaccess</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>.htaccess</span>
                <div className="flex gap-1">
                  {result.sections.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-3 max-h-[480px] overflow-auto">{result.content}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Tip: {sampleHtpasswdLine("user")}</p>
              <div className="flex gap-2">
                <CopyButton getText={() => result.content} label="Copy .htaccess" />
                <DownloadButton getText={() => result.content} filename=".htaccess" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

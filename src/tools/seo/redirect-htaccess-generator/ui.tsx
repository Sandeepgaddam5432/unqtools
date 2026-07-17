"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseBulk,
  buildHtaccess,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RedirectType,
  type DirectiveStyle,
  type RedirectOptions,
  type CommonRedirectOptions,
  type HistoryEntry,
} from "./logic";
import { History, Route, Settings2 } from "lucide-react";

export default function RedirectHtaccessGenerator() {
  const [bulkText, setBulkText] = useState("");
  const [type, setType] = useState<RedirectType>("301");
  const [style, setStyle] = useState<DirectiveStyle>("RewriteRule");
  const [useRegex, setUseRegex] = useState(false);
  const [domain, setDomain] = useState("example.com");
  const [wwwToNonWww, setWwwToNonWww] = useState(false);
  const [nonWwwToWww, setNonWwwToWww] = useState(false);
  const [httpToHttps, setHttpToHttps] = useState(true);
  const [enforceTrailingSlash, setEnforceTrailingSlash] = useState(false);
  const [stripTrailingSlash, setStripTrailingSlash] = useState(false);
  const [stripQueryString, setStripQueryString] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.bulk || p.commonOpts.httpToHttps) {
        setBulkText(p.bulk);
        setType(p.redirectOpts.type);
        setStyle(p.redirectOpts.style);
        setUseRegex(p.redirectOpts.useRegex);
        setDomain(p.commonOpts.domain || "example.com");
        setWwwToNonWww(p.commonOpts.wwwToNonWww);
        setNonWwwToWww(p.commonOpts.nonWwwToWww);
        setHttpToHttps(p.commonOpts.httpToHttps);
        setEnforceTrailingSlash(p.commonOpts.enforceTrailingSlash);
        setStripTrailingSlash(p.commonOpts.stripTrailingSlash);
        setStripQueryString(p.commonOpts.stripQueryString);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const entries = useMemo(() => parseBulk(bulkText), [bulkText]);
  const redirectOpts: RedirectOptions = useMemo(() => ({ type, style, useRegex }), [type, style, useRegex]);
  const commonOpts: CommonRedirectOptions = useMemo(
    () => ({
      domain,
      wwwToNonWww,
      nonWwwToWww,
      httpToHttps,
      enforceTrailingSlash,
      stripTrailingSlash,
      stripQueryString,
    }),
    [domain, wwwToNonWww, nonWwwToWww, httpToHttps, enforceTrailingSlash, stripTrailingSlash, stripQueryString],
  );

  const output = useMemo(() => buildHtaccess(entries, redirectOpts, commonOpts), [entries, redirectOpts, commonOpts]);

  const handleSaveHistory = useCallback(() => {
    if (entries.length > 0 || httpToHttps || wwwToNonWww || nonWwwToWww) {
      saveHistory({
        ts: Date.now(),
        ruleCount: entries.length,
        type,
        style,
      });
      setHistory(loadHistory());
    }
  }, [entries.length, httpToHttps, wwwToNonWww, nonWwwToWww, type, style]);

  const handleClear = useCallback(() => {
    setBulkText("");
    toast.info("Form cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Route className="h-4 w-4" /> Per-page redirects (bulk)
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="rh-bulk">Old to new (one per line, format: /old -&gt; /new)</Label>
            <Textarea
              id="rh-bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"/old-page -> /new-page\n/contact-us, /contact\n^/blog/(.*)$ -> /news/$1"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rh-type">Redirect type</Label>
              <select
                id="rh-type"
                value={type}
                onChange={(e) => setType(e.target.value as RedirectType)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="301">301 (Permanent)</option>
                <option value="302">302 (Found)</option>
                <option value="307">307 (Temp, preserve method)</option>
                <option value="308">308 (Perm, preserve method)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rh-style">Directive</Label>
              <select
                id="rh-style"
                value={style}
                onChange={(e) => setStyle(e.target.value as DirectiveStyle)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="RewriteRule">RewriteRule (mod_rewrite)</option>
                <option value="Redirect">Redirect (mod_alias)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="rh-regex" checked={useRegex} onCheckedChange={setUseRegex} />
              <Label htmlFor="rh-regex" className="text-sm cursor-pointer">Regex patterns</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Settings2 className="h-4 w-4" /> Common rules
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="rh-domain">Domain (for www/non-www rules)</Label>
            <Input
              id="rh-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Switch id="rh-https" checked={httpToHttps} onCheckedChange={setHttpToHttps} />
              <Label htmlFor="rh-https" className="text-sm cursor-pointer">HTTP → HTTPS</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rh-w2n" checked={wwwToNonWww} onCheckedChange={setWwwToNonWww} />
              <Label htmlFor="rh-w2n" className="text-sm cursor-pointer">www → non-www</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rh-n2w" checked={nonWwwToWww} onCheckedChange={setNonWwwToWww} />
              <Label htmlFor="rh-n2w" className="text-sm cursor-pointer">non-www → www</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rh-addslash" checked={enforceTrailingSlash} onCheckedChange={setEnforceTrailingSlash} />
              <Label htmlFor="rh-addslash" className="text-sm cursor-pointer">Enforce trailing /</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rh-stripslash" checked={stripTrailingSlash} onCheckedChange={setStripTrailingSlash} />
              <Label htmlFor="rh-stripslash" className="text-sm cursor-pointer">Strip trailing /</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rh-stripqs" checked={stripQueryString} onCheckedChange={setStripQueryString} />
              <Label htmlFor="rh-stripqs" className="text-sm cursor-pointer">Strip query string</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {output && (entries.length > 0 || httpToHttps || wwwToNonWww || nonWwwToWww || enforceTrailingSlash || stripTrailingSlash || stripQueryString) ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">.htaccess</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{entries.length} per-page rules</Badge>
                <Badge variant="outline">type {type}</Badge>
                <Badge variant="outline">{style}</Badge>
              </div>
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
              {output}
            </pre>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => {
                  handleSaveHistory();
                  return output;
                }}
                label="Copy .htaccess"
              />
              <DownloadButton getText={() => output} filename=".htaccess" mime="text/plain" label="Download" />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({ bulk: bulkText, redirectOpts, commonOpts });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Configure redirects to generate .htaccess"
          hint="Add per-page redirects in bulk mode or toggle common rules (HTTPS, www, trailing slash)."
          icon={<Route className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.ruleCount} rules</Badge>
                  <Badge variant="outline" className="mr-2">{h.type}</Badge>
                  <Badge variant="outline" className="mr-2">{h.style}</Badge>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> .htaccess generation runs locally. History is stored in localStorage on this device only. Always test rules on a staging server before deploying.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

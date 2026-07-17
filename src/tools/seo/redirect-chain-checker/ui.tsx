"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  REDIRECT_TYPE_LIST,
  REDIRECT_TYPES,
  parseUrl,
  analyzeChain,
  renderChainText,
  renderReport,
  parseBulkHops,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type RedirectType,
  type RedirectHop,
  type HistoryEntry,
} from "./logic";
import {
  History,
  GitFork,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Info,
  Upload,
} from "lucide-react";

function moveHop(hops: RedirectHop[], from: number, to: number): RedirectHop[] {
  if (from < 0 || from >= hops.length) return hops;
  if (to < 0 || to >= hops.length) return hops;
  if (from === to) return hops;
  const next = hops.slice();
  const [h] = next.splice(from, 1);
  next.splice(to, 0, h);
  return next.map((hop, i) => ({ ...hop, step: i + 1 }));
}

export default function RedirectChainChecker() {
  const [startUrl, setStartUrl] = useState("");
  const [hops, setHops] = useState<RedirectHop[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.url) {
        setStartUrl(parsed.url);
        if (parsed.hops) setHops(parsed.hops);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsedUrl = useMemo(() => parseUrl(startUrl), [startUrl]);
  const stats = useMemo(() => analyzeChain(hops), [hops]);
  const chainText = useMemo(() => renderChainText(hops), [hops]);
  const report = useMemo(
    () => renderReport(startUrl, hops, stats),
    [startUrl, hops, stats],
  );

  const addHop = useCallback(() => {
    setHops((prev) => [
      ...prev,
      {
        step: prev.length + 1,
        fromUrl: prev.length === 0 ? startUrl : (prev[prev.length - 1]?.toUrl || ""),
        toUrl: "",
        redirectType: "301",
      },
    ]);
  }, [startUrl]);

  const removeHop = useCallback((i: number) => {
    setHops((prev) => moveHop(prev.filter((_, idx) => idx !== i), 0, 0));
  }, []);

  const updateHop = useCallback(
    (i: number, key: keyof RedirectHop, val: string) => {
      setHops((prev) =>
        prev.map((h, idx) => (idx === i ? { ...h, [key]: val } : h)),
      );
    },
    [],
  );

  const handleUp = useCallback(
    (i: number) => setHops((prev) => moveHop(prev, i, i - 1)),
    [],
  );
  const handleDown = useCallback(
    (i: number) => setHops((prev) => moveHop(prev, i, i + 1)),
    [],
  );

  const importBulk = useCallback(() => {
    const parsed = parseBulkHops(bulkText);
    if (parsed.length === 0) {
      toast.error("No valid hops found");
      return;
    }
    setHops(parsed);
    if (parsed.length > 0 && !startUrl) {
      setStartUrl(parsed[0].fromUrl);
    }
    setShowBulk(false);
    setBulkText("");
    toast.success(`Imported ${parsed.length} hops`);
  }, [bulkText, startUrl]);

  const handleSaveHistory = useCallback(() => {
    if (startUrl.trim() || hops.length > 0) {
      saveHistory({
        ts: Date.now(),
        startUrl,
        hopCount: hops.length,
        warningCount: stats.warnings.length,
        snippet: chainText.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [startUrl, hops.length, stats.warnings.length, chainText]);

  const handleClear = useCallback(() => {
    setStartUrl("");
    setHops([]);
    setBulkText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-400">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>How live checking works:</strong> This tool does not make
              HTTP requests (CORS would block most sites). Instead, capture the
              redirect chain using <code>curl -I &lt;URL&gt;</code> or browser
              DevTools (Network tab → Preserve log), then paste the hops below.
              We provide the redirect type reference and analyze the chain you
              enter.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label htmlFor="rcc-url">Start URL</Label>
            <Input
              id="rcc-url"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://example.com/old-page"
              className="mt-1 font-mono text-xs"
            />
            {startUrl && (
              <div className="mt-2 text-xs">
                {parsedUrl.valid ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">{parsedUrl.protocol}</Badge>
                    <Badge variant="outline" className="text-xs">{parsedUrl.hostname}</Badge>
                    {parsedUrl.port && <Badge variant="outline" className="text-xs">:{parsedUrl.port}</Badge>}
                    {parsedUrl.pathname && parsedUrl.pathname !== "/" && (
                      <Badge variant="outline" className="text-xs">{parsedUrl.pathname}</Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-red-600 dark:text-red-400">
                    Invalid URL: {parsedUrl.error}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Redirect chain ({hops.length} hops)
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBulk((s) => !s)}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Bulk paste
              </Button>
              <Button size="sm" variant="outline" onClick={addHop} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add hop
              </Button>
            </div>
          </div>
          {showBulk && (
            <div className="space-y-1.5">
              <Label htmlFor="rcc-bulk">
                Bulk paste (from | type | to — one per line, optional 4th column for note)
              </Label>
              <Textarea
                id="rcc-bulk"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"https://a.com | 301 | https://b.com | migration\nhttps://b.com | 302 | https://c.com"}
                className="min-h-[100px] font-mono text-xs resize-y"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={importBulk}
                disabled={!bulkText.trim()}
              >
                Import {bulkText ? `(${parseBulkHops(bulkText).length} hops)` : ""}
              </Button>
            </div>
          )}
          {hops.map((h, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Hop #{i + 1}</Badge>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleUp(i)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDown(i)}
                    disabled={i === hops.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeHop(i)}
                    aria-label="Remove hop"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor={`from-${i}`} className="text-xs">From URL</Label>
                <Input
                  id={`from-${i}`}
                  value={h.fromUrl}
                  onChange={(e) => updateHop(i, "fromUrl", e.target.value)}
                  placeholder="https://example.com/old"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <Label htmlFor={`type-${i}`} className="text-xs">Redirect type</Label>
                <Select
                  value={h.redirectType}
                  onValueChange={(v) => updateHop(i, "redirectType", v)}
                >
                  <SelectTrigger id={`type-${i}`} className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REDIRECT_TYPE_LIST.map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.code} — {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`to-${i}`} className="text-xs">To URL</Label>
                <Input
                  id={`to-${i}`}
                  value={h.toUrl}
                  onChange={(e) => updateHop(i, "toUrl", e.target.value)}
                  placeholder="https://example.com/new"
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {hops.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Chain analysis</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Hops</div>
                  <div className="text-lg font-semibold">{stats.hopCount}</div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">All permanent?</div>
                  <div className={`text-lg font-semibold ${stats.allPermanent ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {stats.allPermanent ? "Yes" : "No"}
                  </div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Long chain?</div>
                  <div className={`text-lg font-semibold ${stats.isLongChain ? "text-red-600 dark:text-red-400" : ""}`}>
                    {stats.isLongChain ? "Yes" : "No"}
                  </div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Warnings</div>
                  <div className={`text-lg font-semibold ${stats.warnings.length > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {stats.warnings.length}
                  </div>
                </div>
              </div>
              {stats.finalUrl && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Final URL: </span>
                  <span className="font-mono text-foreground">{stats.finalUrl}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {stats.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
              {stats.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Chain visualization</h3>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {chainText}
              </pre>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return report; }} label="Copy report" />
            <DownloadButton
              getText={() => report}
              filename="redirect-chain-report.md"
              label="Download .md"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(startUrl, hops); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      )}

      {hops.length === 0 && (
        <EmptyState
          title="Enter a URL and add redirect hops"
          hint="Build a redirect chain manually or paste it from curl/DevTools output. We analyze hop count, redirect types, and flag issues."
          icon={<GitFork className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Redirect type reference</h3>
          <div className="space-y-2">
            {REDIRECT_TYPE_LIST.map((t) => (
              <div key={t.code} className="rounded-md border p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={t.permanent ? "default" : "outline"}>
                      {t.code}
                    </Badge>
                    <span className="font-medium">{t.name}</span>
                  </div>
                  <Badge variant={t.permanent ? "secondary" : "outline"} className="text-xs">
                    {t.permanent ? "Permanent" : "Temporary"}
                  </Badge>
                </div>
                <div className="text-muted-foreground">{t.description}</div>
                <div>
                  <span className="font-medium text-foreground">Use case:</span>{" "}
                  <span className="text-muted-foreground">{t.useCase}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">SEO impact:</span>{" "}
                  <span className="text-muted-foreground">{t.seoImpact}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.hopCount} hops</Badge>
                  {h.warningCount > 0 && (
                    <Badge variant="outline" className="mr-2 text-amber-700 dark:text-amber-400">
                      {h.warningCount} warnings
                    </Badge>
                  )}
                  <span className="text-muted-foreground">{h.startUrl || "(no URL)"}</span>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> No network
            requests are made. All parsing and analysis runs locally. History is
            stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

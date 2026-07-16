"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseBulkUrls,
  generateSitemap,
  generateSitemapIndex,
  computeStats,
  formatBytes,
  buildRobotsTxtSnippet,
  priorityPresets,
  CHANGE_FREQS,
  loadHistory,
  saveHistory,
  clearHistory,
  type SitemapUrl,
  type ChangeFreq,
  type HistoryEntry,
} from "./logic";
import { History, FileText, Layers } from "lucide-react";

export default function XmlSitemapGenerator() {
  const [bulk, setBulk] = useState("");
  const [mode, setMode] = useState<"sitemap" | "index">("sitemap");
  const [defaultLastmod, setDefaultLastmod] = useState("");
  const [defaultChangefreq, setDefaultChangefreq] = useState<ChangeFreq>("weekly");
  const [defaultPriority, setDefaultPriority] = useState("0.8");
  const [indexEntries, setIndexEntries] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const urls = useMemo<SitemapUrl[]>(() => {
    const parsed = parseBulkUrls(bulk);
    // Apply defaults for missing fields
    return parsed.map((u) => ({
      ...u,
      lastmod: u.lastmod || defaultLastmod || undefined,
      changefreq: u.changefreq || defaultChangefreq,
      priority: u.priority ?? parseFloat(defaultPriority),
    }));
  }, [bulk, defaultLastmod, defaultChangefreq, defaultPriority]);

  const output = useMemo(() => {
    try {
      if (mode === "sitemap") {
        if (urls.length === 0) return "";
        return generateSitemap(urls);
      } else {
        const lines = indexEntries.split(/\n+/).map((l) => l.trim()).filter(Boolean);
        const entries = lines.map((line) => {
          const [loc, lastmod] = line.split(/[|\t,]/).map((p) => p.trim());
          return { loc, lastmod: lastmod || undefined };
        }).filter((e) => e.loc);
        if (entries.length === 0) return "";
        return generateSitemapIndex(entries);
      }
    } catch (e) {
      return "";
    }
  }, [mode, urls, indexEntries]);

  const stats = useMemo(() => {
    if (!output) return null;
    return computeStats(output, mode === "sitemap" ? urls.length : indexEntries.split(/\n+/).filter(Boolean).length);
  }, [output, urls.length, indexEntries, mode]);

  const robotsSnippet = useMemo(() => {
    if (mode === "sitemap" && urls.length > 0) {
      return buildRobotsTxtSnippet(urls[0].loc);
    }
    return "";
  }, [urls, mode]);

  const handleCopy = useCallback(() => {
    if (output) {
      saveHistory({
        ts: Date.now(),
        urlCount: stats?.urlCount ?? 0,
        snippet: output.slice(0, 200),
      });
      setHistory(loadHistory());
    }
  }, [output, stats]);

  const handleClear = useCallback(() => {
    setBulk("");
    setIndexEntries("");
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
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "sitemap" | "index")}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sitemap">URL sitemap</SelectItem>
                  <SelectItem value="index">Sitemap index</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "sitemap" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="sm-lastmod">Default lastmod</Label>
                  <Input
                    id="sm-lastmod"
                    type="date"
                    value={defaultLastmod}
                    onChange={(e) => setDefaultLastmod(e.target.value)}
                    className="w-44"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Default changefreq</Label>
                  <Select value={defaultChangefreq} onValueChange={(v) => setDefaultChangefreq(v as ChangeFreq)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANGE_FREQS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Default priority</Label>
                  <Select value={defaultPriority} onValueChange={setDefaultPriority}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorityPresets().map((p) => (
                        <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          {mode === "sitemap" ? (
            <>
              <Label htmlFor="sm-bulk">URLs (one per line — optionally add | lastmod | changefreq | priority)</Label>
              <Textarea
                id="sm-bulk"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={"https://example.com/\nhttps://example.com/about|2026-01-01|daily|0.9\nhttps://example.com/blog|2026-01-01|weekly|0.7"}
                className="min-h-[160px] font-mono text-xs resize-y"
              />
              <Badge variant="outline" className="text-xs w-fit">{urls.length} valid URLs</Badge>
            </>
          ) : (
            <>
              <Label htmlFor="sm-index">Sitemap URLs (one per line — optionally add | lastmod)</Label>
              <Textarea
                id="sm-index"
                value={indexEntries}
                onChange={(e) => setIndexEntries(e.target.value)}
                placeholder={"https://example.com/sitemap1.xml|2026-01-01\nhttps://example.com/sitemap2.xml"}
                className="min-h-[120px] font-mono text-xs resize-y"
              />
            </>
          )}
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">URLs</div>
            <div className="text-lg font-semibold">{stats.urlCount}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">File size</div>
            <div className="text-lg font-semibold">{formatBytes(stats.byteSize)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Within limits</div>
            <div className={`text-lg font-semibold ${stats.isWithinLimits ? "text-emerald-600" : "text-red-600"}`}>
              {stats.isWithinLimits ? "Yes" : "No"}
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Needs index</div>
            <div className={`text-lg font-semibold ${stats.needsIndex ? "text-amber-600" : "text-emerald-600"}`}>
              {stats.needsIndex ? "Yes" : "No"}
            </div>
          </CardContent></Card>
        </div>
      )}

      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated XML</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton
                getText={() => output}
                filename={mode === "sitemap" ? "sitemap.xml" : "sitemap-index.xml"}
                mime="application/xml"
              />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all max-h-[400px]">
            {output}
          </pre>
          {robotsSnippet && (
            <Card>
              <CardContent className="p-3 space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> robots.txt snippet
                </div>
                <pre className="font-mono text-xs whitespace-pre-wrap">{robotsSnippet}</pre>
              </CardContent>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Tip:</strong> serve as <code>sitemap.xml.gz</code> for large files — gzip compression typically reduces size by 80-90%.
          </p>
        </div>
      ) : (
        <EmptyState
          title="Paste URLs to generate a sitemap"
          hint={mode === "sitemap"
            ? "One URL per line. Add | lastmod | changefreq | priority for full options."
            : "One sitemap URL per line. Add | lastmod for the date."}
          icon={<Layers className="h-8 w-8" />}
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
                  <span className="font-medium">{h.urlCount} URLs</span>
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> sitemap XML generation runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  parseBacklinks,
  analyze,
  renderCsv,
  buildChartData,
  HEALTHY_PROFILE,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HistoryEntry,
  type AnchorCategory,
} from "./logic";
import { History, Link2, AlertTriangle } from "lucide-react";

const CATEGORY_LABELS: Record<AnchorCategory, string> = {
  "exact-match": "Exact match",
  "partial-match": "Partial match",
  "branded": "Branded",
  "generic": "Generic",
  "naked-url": "Naked URL",
  "image": "Image",
};

export default function AnchorTextDistributionAnalyzer() {
  const [text, setText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [brand, setBrand] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.text !== undefined) {
        setText(parsed.text);
        if (parsed.keyword !== undefined) setKeyword(parsed.keyword);
        if (parsed.brand !== undefined) setBrand(parsed.brand);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const backlinks = useMemo(() => parseBacklinks(text), [text]);
  const result = useMemo(
    () => analyze(backlinks, { keyword, brand }),
    [backlinks, keyword, brand],
  );
  const chartData = useMemo(() => buildChartData(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.total > 0) {
      saveHistory({
        ts: Date.now(),
        total: result.total,
        exactPct: result.perCategory["exact-match"].percentage,
        brandedPct: result.perCategory["branded"].percentage,
        warningCount: result.warnings.length,
        snippet: text.slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [result, text]);

  const handleClear = useCallback(() => {
    setText("");
    setKeyword("");
    setBrand("");
    toast.info("Cleared");
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="atda-keyword">Target keyword (for exact/partial match)</Label>
              <Input
                id="atda-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="running shoes"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="atda-brand">Brand name (for branded detection)</Label>
              <Input
                id="atda-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Nike"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atda-text">Backlink data (URL | anchor — one per line)</Label>
            <Textarea
              id="atda-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"https://site1.com | running shoes\nhttps://site2.com | best running shoes 2026\nhttps://site3.com | Nike running\nhttps://site4.com | click here"}
              className="min-h-[180px] font-mono text-xs resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {result.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Distribution ({result.total} backlinks)</h3>
              <div className="flex h-8 w-full overflow-hidden rounded-md border bg-muted/30">
                {chartData.map((d, i) => (
                  d.percentage > 0 && (
                    <div
                      key={i}
                      style={{ width: `${d.percentage}%`, backgroundColor: d.color }}
                      className="flex items-center justify-center text-xs font-medium text-white transition-all"
                      title={`${CATEGORY_LABELS[d.category]}: ${d.percentage.toFixed(1)}%`}
                    >
                      {d.percentage > 5 && <span>{d.percentage.toFixed(0)}%</span>}
                    </div>
                  )
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {chartData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="inline-block h-3 w-3 rounded flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground flex-1">{CATEGORY_LABELS[d.category]}</span>
                    <Badge variant="outline">{result.perCategory[d.category].count}</Badge>
                    <span className="font-semibold w-12 text-right">{d.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-2">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {result.topAnchors.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Top 10 anchors</h3>
                <div className="space-y-1">
                  {result.topAnchors.map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono truncate">{a.anchor}</span>
                      <Badge variant="outline">{a.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Healthy profile reference</h3>
              <div className="space-y-1 text-xs">
                {(Object.keys(HEALTHY_PROFILE) as AnchorCategory[]).map((cat) => (
                  <div key={cat} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                    <span className="text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
                    <Badge variant="outline">{HEALTHY_PROFILE[cat].min}-{HEALTHY_PROFILE[cat].max}%</Badge>
                    <span className="text-muted-foreground text-xs flex-1 text-right">{HEALTHY_PROFILE[cat].note}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
            <DownloadButton
              getText={() => csv}
              filename="anchor-text-distribution.csv"
              label="Download CSV"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ text, keyword, brand }); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste your backlink data"
          hint="Format: URL | anchor (or URL\таnchor), one per line. Set your target keyword and brand name above so we can categorize anchors properly."
          icon={<Link2 className="h-8 w-8" />}
        />
      )}

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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mr-2">{h.total} links</Badge>
                    <span className="text-muted-foreground">exact {h.exactPct.toFixed(0)}% · branded {h.brandedPct.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.warningCount > 0 && (
                      <Badge variant="outline" className="text-amber-700 dark:text-amber-400">{h.warningCount} warnings</Badge>
                    )}
                    <span className="text-muted-foreground/70">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All
            categorization and analysis runs locally. We don't fetch your
            backlinks — you paste them. History is stored in localStorage on
            this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  parseBulk,
  estimateBulk,
  renderCsv,
  RANKING_FACTORS_REFERENCE,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type EstimateInput,
  type BulkResult,
  type HistoryEntry,
} from "./logic";
import { History, Target, ListChecks, BookOpen } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "Top 3": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "Top 10": "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30",
  "Top 20": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "Top 50": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "Top 100": "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "Beyond 100": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

export default function SerpPositionChecker() {
  const [bulkText, setBulkText] = useState("");
  const [da, setDa] = useState(40);
  const [backlinks, setBacklinks] = useState(20);
  const [contentWords, setContentWords] = useState(1000);
  const [titleHasKeyword, setTitleHasKeyword] = useState(true);
  const [intentMatch, setIntentMatch] = useState(true);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setBulkText(p.data);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const defaults: Partial<EstimateInput> = useMemo(
    () => ({ domainAuthority: da, backlinks, contentWords, titleHasKeyword, intentMatch }),
    [da, backlinks, contentWords, titleHasKeyword, intentMatch],
  );

  const csv = useMemo(() => result ? renderCsv(result) : "", [result]);

  const handleRun = useCallback(() => {
    const inputs = parseBulk(bulkText, defaults);
    if (inputs.length === 0) {
      toast.error("Enter at least one keyword");
      return;
    }
    const r = estimateBulk(inputs);
    setResult(r);
    const top10 = r.byCategory["Top 3"] ?? 0 + (r.byCategory["Top 10"] ?? 0);
    saveHistory({ ts: Date.now(), total: r.total, top10 });
    setHistory(loadHistory());
    toast.success(`Estimated ${r.total} keyword(s)`);
  }, [bulkText, defaults]);

  const handleClear = useCallback(() => {
    setBulkText("");
    setResult(null);
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
          <div className="flex items-center justify-between">
            <Label htmlFor="spc-bulk">Keywords (one per line — `keyword,url` optional)</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBulkText("best seo tools,https://example.com/best-seo-tools\ncontent marketing guide,https://example.com/content-marketing\nhow to do keyword research");
                toast.info("Sample loaded");
              }}
            >Load sample</Button>
          </div>
          <Textarea
            id="spc-bulk"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"best seo tools,https://example.com/best-seo-tools\ncontent marketing,https://example.com/blog"}
            className="min-h-[120px] resize-y font-mono text-xs"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="spc-da" className="text-xs">Domain authority (0-100)</Label>
              <Input id="spc-da" type="number" min={0} max={100} value={da}
                onChange={(e) => setDa(parseInt(e.target.value, 10) || 0)} className="h-8 text-xs" />
            </div>
            <div>
              <Label htmlFor="spc-bl" className="text-xs">Backlinks (count)</Label>
              <Input id="spc-bl" type="number" min={0} value={backlinks}
                onChange={(e) => setBacklinks(parseInt(e.target.value, 10) || 0)} className="h-8 text-xs" />
            </div>
            <div>
              <Label htmlFor="spc-cw" className="text-xs">Content words</Label>
              <Input id="spc-cw" type="number" min={0} value={contentWords}
                onChange={(e) => setContentWords(parseInt(e.target.value, 10) || 0)} className="h-8 text-xs" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={titleHasKeyword}
                onChange={(e) => setTitleHasKeyword(e.target.checked)} />
              Keyword in title tag
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={intentMatch}
                onChange={(e) => setIntentMatch(e.target.checked)} />
              Intent matches
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleRun} disabled={!bulkText.trim()} className="gap-1">
              <Target className="h-3.5 w-3.5" /> Estimate positions
            </Button>
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {result && result.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Summary ({result.total} keywords)
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.byCategory).map(([cat, count]) => (
                  <Badge key={cat} variant="outline" className={CATEGORY_COLORS[cat]}>
                    {cat}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Estimated positions</h3>
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {result.results.map((r, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 font-mono text-foreground font-medium truncate">{r.keyword}</div>
                      <Badge variant="outline" className={CATEGORY_COLORS[r.category]}>~{r.estimatedPosition} · {r.category}</Badge>
                    </div>
                    {r.url && <div className="text-muted-foreground truncate">URL: {r.url} ({r.urlMatch} match)</div>}
                    <div className="flex flex-wrap gap-3 text-muted-foreground">
                      <span>difficulty: <strong className="text-foreground">{r.difficulty}/100</strong></span>
                      <span>intent: <strong className="text-foreground">{r.intent}</strong></span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px]">
                      {r.factors.map((f, j) => (
                        <div key={j} className="rounded border px-1.5 py-1">
                          <div className="text-muted-foreground">{f.name}</div>
                          <div className="font-semibold text-foreground">{f.raw}</div>
                        </div>
                      ))}
                    </div>
                    {r.recommendations.length > 0 && (
                      <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-0.5">
                        {r.recommendations.slice(0, 3).map((rec, j) => <li key={j}>{rec}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => csv} label="Copy CSV" />
                <DownloadButton getText={() => csv} filename="serp-position-estimate.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => buildShareUrl(bulkText)} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter keywords to estimate SERP positions"
          hint="One keyword per line. Append URL after a comma to enable URL match check. Click 'Load sample' to try it."
          icon={<Target className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Ranking factors reference
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {RANKING_FACTORS_REFERENCE.map((f) => (
              <div key={f.name} className="rounded border bg-background px-3 py-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{f.name}</span>
                  <Badge variant="secondary" className="text-[10px]">weight {f.weight}</Badge>
                </div>
                <div className="text-muted-foreground text-[11px]">{f.description}</div>
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
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.total} keywords</Badge>
                  <Badge variant="outline" className="mr-2">{h.top10} top 10</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All estimation runs locally — there is no live SERP API. Estimates are directional indicators derived from difficulty factors. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
